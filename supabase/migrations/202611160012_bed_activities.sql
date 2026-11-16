begin;

alter table public.garden_layout_events
  add column event_kind text not null default 'layout' check (event_kind in ('layout','planting','mulch')),
  add column bed_id text,
  add column activity_id uuid,
  add column planned_date date;

create table public.bed_activities (
  id uuid primary key,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  bed_id text not null check (length(btrim(bed_id)) between 1 and 128),
  kind text not null check (kind in ('planting','mulch')),
  status text not null default 'planned' check (status in ('planned','completed','cancelled')),
  planned_date date not null check (planned_date between date '0001-01-01' and date '9999-12-31'),
  title text not null check (length(btrim(title)) between 1 and 120),
  notes text not null default '' check (length(notes) <= 2000),
  planned_snapshot jsonb not null,
  source_version bigint not null,
  version bigint not null default 1,
  activity_order bigint not null default nextval('public.garden_layout_events_event_order_seq'),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  was_planned boolean not null default true,
  completed_date date,
  completed_notes text,
  completion_event_id uuid unique references public.garden_layout_events(id)
);
alter table public.garden_layout_events add foreign key (activity_id) references public.bed_activities(id);
create unique index garden_layout_events_activity_idx on public.garden_layout_events(activity_id) where activity_id is not null;
create index bed_activities_garden_idx on public.bed_activities(garden_id, status, activity_order);
alter table public.bed_activities enable row level security;
revoke all on public.bed_activities from public, anon, authenticated;
grant select on public.bed_activities to authenticated;
create policy bed_activities_read on public.bed_activities for select to authenticated
using (exists (select 1 from public.gardens g where g.id = garden_id));

create function public.myco_activity_garden(p_garden_id uuid)
returns public.gardens language plpgsql security definer set search_path = '' as $$
declare result public.gardens;
begin
  select g.* into result from public.gardens g
  where g.id = p_garden_id and (g.owner_id = (select auth.uid()) or exists (
    select 1 from public.garden_members m where m.garden_id = g.id and m.user_id = (select auth.uid())
  )) for update;
  if not found then raise exception 'Garden is unavailable' using errcode = '42501'; end if;
  return result;
end;
$$;
revoke all on function public.myco_activity_garden(uuid) from public, anon, authenticated;

create function public.complete_bed_activity(p_garden_id uuid, p_activity_id uuid, p_activity_version bigint,
  p_garden_version bigint, p_completed_date date, p_notes text)
returns public.bed_activities language plpgsql security definer set search_path = '' as $$
declare garden public.gardens; activity public.bed_activities; event_id uuid;
begin
  garden := public.myco_activity_garden(p_garden_id);
  select a.* into activity from public.bed_activities a where a.id = p_activity_id and a.garden_id = garden.id for update;
  if not found then raise exception 'Activity is unavailable' using errcode = 'P0002'; end if;
  if p_completed_date is null or p_completed_date not between date '0001-01-01' and date '9999-12-31'
    or length(coalesce(p_notes,'')) > 2000 then raise exception 'Check completion details' using errcode = '22023'; end if;
  if activity.status = 'completed' then
    if activity.completed_date = p_completed_date and activity.completed_notes = btrim(coalesce(p_notes,'')) then return activity; end if;
    raise exception 'Completed activities are fixed' using errcode = '22023';
  end if;
  if activity.status <> 'planned' then raise exception 'Activity is not planned' using errcode = '22023'; end if;
  if p_activity_version is null or activity.version <> p_activity_version or p_garden_version is null or garden.version <> p_garden_version then
    raise exception 'Garden or activity changed' using errcode = '40001';
  end if;
  if not exists (select 1 from jsonb_array_elements(garden.beds) b where b->>'id' = activity.bed_id) then
    raise exception 'Bed no longer exists in the current plan' using errcode = 'P0002';
  end if;
  event_id := gen_random_uuid();
  insert into public.garden_layout_events(id,garden_id,event_date,title,notes,source_version,snapshot,actor_id,event_kind,bed_id,activity_id,planned_date)
  values (event_id,garden.id,p_completed_date,activity.title,btrim(coalesce(p_notes,'')),garden.version,
    jsonb_build_object('name',garden.name,'dimensions',jsonb_build_object('widthCm',garden.width_cm,'lengthCm',garden.length_cm),'beds',garden.beds),
    (select auth.uid()),activity.kind,activity.bed_id,activity.id,case when activity.was_planned then activity.planned_date else null end);
  update public.bed_activities set status='completed', completed_date=p_completed_date, completed_notes=btrim(coalesce(p_notes,'')),
    completion_event_id=event_id, version=version+1, updated_at=clock_timestamp() where id=activity.id returning * into activity;
  return activity;
end;
$$;

create function public.save_bed_activity(p_garden_id uuid, p_activity_id uuid, p_activity_version bigint,
  p_garden_version bigint, p_bed_id text, p_kind text, p_planned_date date, p_title text, p_notes text, p_completed_date date)
returns public.bed_activities language plpgsql security definer set search_path = '' as $$
declare garden public.gardens; activity public.bed_activities; body jsonb;
begin
  garden := public.myco_activity_garden(p_garden_id);
  if p_activity_id is null or p_kind is null or p_kind not in ('planting','mulch')
    or p_planned_date is null or p_planned_date not between date '0001-01-01' and date '9999-12-31'
    or p_title is null or length(btrim(p_title)) not between 1 and 120 or length(coalesce(p_notes,'')) > 2000 then
    raise exception 'Check activity details' using errcode = '22023'; end if;
  select a.* into activity from public.bed_activities a where a.id=p_activity_id for update;
  if found then
    if activity.garden_id <> garden.id then raise exception 'Activity is unavailable' using errcode = '42501'; end if;
    if p_activity_version is null and activity.actor_id = (select auth.uid()) and activity.bed_id=p_bed_id
      and activity.kind=p_kind and activity.planned_date=p_planned_date and activity.title=btrim(p_title) and activity.notes=btrim(coalesce(p_notes,'')) then
      if p_completed_date is not null then return public.complete_bed_activity(garden.id,activity.id,activity.version,p_garden_version,p_completed_date,p_notes); end if;
      return activity;
    end if;
    if activity.status <> 'planned' then raise exception 'Only planned activities can be changed' using errcode = '22023'; end if;
    if p_activity_version is null or activity.version <> p_activity_version then raise exception 'Activity changed' using errcode = '40001'; end if;
  elsif p_activity_version is not null then raise exception 'Activity is unavailable' using errcode = 'P0002';
  end if;
  if p_garden_version is null or garden.version <> p_garden_version then raise exception 'Garden changed' using errcode = '40001'; end if;
  if not exists (select 1 from jsonb_array_elements(garden.beds) b where b->>'id'=p_bed_id) then
    raise exception 'Choose an existing bed' using errcode = '22023'; end if;
  body := jsonb_build_object('name',garden.name,'dimensions',jsonb_build_object('widthCm',garden.width_cm,'lengthCm',garden.length_cm),'beds',garden.beds);
  if activity.id is null then
    insert into public.bed_activities(id,garden_id,bed_id,kind,planned_date,title,notes,planned_snapshot,source_version,actor_id,was_planned)
    values(p_activity_id,garden.id,p_bed_id,p_kind,p_planned_date,btrim(p_title),btrim(coalesce(p_notes,'')),body,garden.version,(select auth.uid()),p_completed_date is null)
    returning * into activity;
  else
    update public.bed_activities set bed_id=p_bed_id,kind=p_kind,planned_date=p_planned_date,title=btrim(p_title),notes=btrim(coalesce(p_notes,'')),
      planned_snapshot=body,source_version=garden.version,version=version+1,updated_at=clock_timestamp() where id=activity.id returning * into activity;
  end if;
  if p_completed_date is not null then return public.complete_bed_activity(garden.id,activity.id,activity.version,garden.version,p_completed_date,p_notes); end if;
  return activity;
end;
$$;

create function public.cancel_bed_activity(p_garden_id uuid,p_activity_id uuid,p_activity_version bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare activity public.bed_activities;
begin
  perform public.myco_activity_garden(p_garden_id);
  select a.* into activity from public.bed_activities a where a.id=p_activity_id and a.garden_id=p_garden_id for update;
  if not found then raise exception 'Activity is unavailable' using errcode = 'P0002'; end if;
  if activity.status='cancelled' then return; end if;
  if activity.status<>'planned' then raise exception 'Completed activities are fixed' using errcode='22023'; end if;
  if p_activity_version is null or activity.version<>p_activity_version then raise exception 'Activity changed' using errcode='40001'; end if;
  update public.bed_activities set status='cancelled',version=version+1,updated_at=clock_timestamp() where id=activity.id;
end;
$$;
revoke all on function public.save_bed_activity(uuid,uuid,bigint,bigint,text,text,date,text,text,date) from public,anon,authenticated;
revoke all on function public.complete_bed_activity(uuid,uuid,bigint,bigint,date,text) from public,anon,authenticated;
revoke all on function public.cancel_bed_activity(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.save_bed_activity(uuid,uuid,bigint,bigint,text,text,date,text,text,date) to authenticated;
grant execute on function public.complete_bed_activity(uuid,uuid,bigint,bigint,date,text) to authenticated;
grant execute on function public.cancel_bed_activity(uuid,uuid,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
