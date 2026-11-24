begin;

-- Dated intentions contain metadata only. The garden remains the editable plan.
create table public.garden_tasks (
  id uuid primary key,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  task_order bigint generated always as identity unique,
  bed_id text,
  bed_name text,
  activity_type text not null check (activity_type in ('planting','mulch','care','harvest','other')),
  planned_date date not null check (planned_date between date '0001-01-01' and date '9999-12-31'),
  title text not null check (length(btrim(title)) between 1 and 120),
  notes text not null default '' check (length(notes) <= 2000),
  status text not null default 'planned' check (status in ('planned','completed','cancelled')),
  version bigint not null default 1 check (version > 0),
  completed_date date,
  completed_notes text,
  completion_event_id uuid unique references public.garden_layout_events(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  last_request_id uuid not null,
  last_request_actor uuid references auth.users(id) on delete set null,
  last_request_payload jsonb not null,
  check ((status = 'completed') = (completed_date is not null)),
  check (completed_date is null or completed_date between date '0001-01-01' and date '9999-12-31')
);
create index garden_tasks_garden_idx on public.garden_tasks(garden_id, task_order);
alter table public.garden_tasks enable row level security;
revoke all on public.garden_tasks from public, anon, authenticated;
grant select on public.garden_tasks to authenticated;
create policy garden_tasks_read on public.garden_tasks for select to authenticated
using (exists (select 1 from public.gardens g where g.id = garden_id));

-- Read just calendar metadata, using source-table RLS and frozen bed names.
create view public.garden_work_events with (security_invoker = true) as
select e.id, e.garden_id, e.event_order, e.event_date, e.title, e.notes,
  e.source_version, e.recorded_at, e.actor_id, e.event_kind, e.bed_id,
  e.planned_date, e.version, e.updated_at, e.deleted_at,
  (select b->>'name' from jsonb_array_elements(coalesce(e.display_snapshot,e.snapshot)->'beds') b
    where b->>'id'=e.bed_id limit 1) as bed_name
from public.garden_layout_events e;
revoke all on public.garden_work_events from public, anon, authenticated;
grant select on public.garden_work_events to authenticated;

create function public.save_garden_task(
  p_garden_id uuid, p_task_id uuid, p_expected_version bigint, p_request_id uuid,
  p_bed_id text, p_activity_type text, p_planned_date date, p_title text, p_notes text,
  p_cancel boolean default false
) returns public.garden_tasks language plpgsql security definer set search_path='' as $$
declare
  garden public.gardens; existing public.garden_tasks; result public.garden_tasks;
  request_payload jsonb; chosen_bed_name text;
begin
  garden := public.myco_activity_garden(p_garden_id);
  if p_task_id is null or p_request_id is null or p_cancel is null
    or p_activity_type is null or p_activity_type not in ('planting','mulch','care','harvest','other')
    or p_planned_date is null or p_planned_date not between date '0001-01-01' and date '9999-12-31'
    or p_title is null or length(btrim(p_title)) not between 1 and 120
    or length(coalesce(p_notes,'')) > 2000
    or (p_bed_id is not null and length(btrim(p_bed_id)) not between 1 and 128) then
    raise exception 'Check task date, title, activity and bed' using errcode='22023';
  end if;
  request_payload := jsonb_build_array('save',p_bed_id,p_activity_type,p_planned_date,btrim(p_title),btrim(coalesce(p_notes,'')),p_cancel);
  select * into existing from public.garden_tasks where id=p_task_id for update;
  if found then
    if existing.garden_id <> garden.id then raise exception 'Task unavailable' using errcode='42501'; end if;
    if existing.last_request_id=p_request_id and existing.last_request_actor=(select auth.uid()) then
      if existing.last_request_payload=request_payload then return existing; end if;
      raise exception 'Request already used' using errcode='22023';
    end if;
    if p_expected_version is null or existing.version<>p_expected_version then raise exception 'Task changed' using errcode='40001'; end if;
    if existing.status<>'planned' then raise exception 'Task is no longer planned' using errcode='40001'; end if;
  elsif p_expected_version is not null or p_cancel then
    raise exception 'Task unavailable' using errcode='P0002';
  end if;
  if p_bed_id is not null and not p_cancel then
    select b->>'name' into chosen_bed_name from jsonb_array_elements(garden.beds) b where b->>'id'=p_bed_id;
    if not found then raise exception 'Choose an existing bed' using errcode='22023'; end if;
  end if;
  if existing.id is null then
    insert into public.garden_tasks(id,garden_id,bed_id,bed_name,activity_type,planned_date,title,notes,created_by,last_request_id,last_request_actor,last_request_payload)
    values(p_task_id,garden.id,p_bed_id,chosen_bed_name,p_activity_type,p_planned_date,btrim(p_title),btrim(coalesce(p_notes,'')),(select auth.uid()),p_request_id,(select auth.uid()),request_payload)
    returning * into result;
  else
    update public.garden_tasks set bed_id=p_bed_id,bed_name=case when p_cancel then existing.bed_name else chosen_bed_name end,
      activity_type=p_activity_type,planned_date=p_planned_date,title=btrim(p_title),notes=btrim(coalesce(p_notes,'')),
      status=case when p_cancel then 'cancelled' else 'planned' end,version=version+1,updated_at=clock_timestamp(),
      last_request_id=p_request_id,last_request_actor=(select auth.uid()),last_request_payload=request_payload
    where id=existing.id returning * into result;
  end if;
  return result;
end; $$;

create function public.complete_garden_task(
  p_garden_id uuid,p_task_id uuid,p_expected_version bigint,p_garden_version bigint,
  p_request_id uuid,p_completed_date date,p_notes text,p_confirmed boolean
) returns public.garden_tasks language plpgsql security definer set search_path='' as $$
declare
  garden public.gardens; task public.garden_tasks; result public.garden_tasks;
  recorded public.garden_layout_events; request_payload jsonb;
begin
  garden := public.myco_activity_garden(p_garden_id);
  if p_task_id is null or p_request_id is null or p_confirmed is distinct from true
    or p_expected_version is null or p_expected_version<1 or p_garden_version is null or p_garden_version<1
    or p_completed_date is null or p_completed_date not between date '0001-01-01' and date '9999-12-31'
    or length(coalesce(p_notes,''))>2000 then
    raise exception 'Review and confirm the completed work' using errcode='22023';
  end if;
  request_payload := jsonb_build_array('complete',p_completed_date,btrim(coalesce(p_notes,'')));
  select * into task from public.garden_tasks where id=p_task_id and garden_id=garden.id for update;
  if not found then raise exception 'Task unavailable' using errcode='P0002'; end if;
  if task.last_request_id=p_request_id and task.last_request_actor=(select auth.uid()) then
    if task.last_request_payload=request_payload and task.status='completed' then return task; end if;
    raise exception 'Request already used' using errcode='22023';
  end if;
  if task.version<>p_expected_version or task.status<>'planned' or garden.version<>p_garden_version then
    raise exception 'Task or saved garden changed; review again' using errcode='40001';
  end if;
  if task.bed_id is null then
    recorded := public.record_garden_layout_event(garden.id,garden.version,gen_random_uuid(),p_completed_date,task.title,p_notes);
  else
    recorded := public.record_bed_changes(garden.id,garden.version,gen_random_uuid(),task.bed_id,p_completed_date,task.title,p_notes);
  end if;
  update public.garden_tasks set status='completed',completed_date=p_completed_date,completed_notes=btrim(coalesce(p_notes,'')),
    completion_event_id=recorded.id,version=version+1,updated_at=clock_timestamp(),
    last_request_id=p_request_id,last_request_actor=(select auth.uid()),last_request_payload=request_payload
  where id=task.id returning * into result;
  return result;
end; $$;
revoke all on function public.save_garden_task(uuid,uuid,bigint,uuid,text,text,date,text,text,boolean), public.complete_garden_task(uuid,uuid,bigint,bigint,uuid,date,text,boolean) from public,anon,authenticated;
grant execute on function public.save_garden_task(uuid,uuid,bigint,uuid,text,text,date,text,text,boolean), public.complete_garden_task(uuid,uuid,bigint,bigint,uuid,date,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
