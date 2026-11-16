begin;

alter table public.bed_activities alter column planned_date drop not null;

create or replace function public.save_bed_activity(p_garden_id uuid, p_activity_id uuid, p_activity_version bigint,
  p_garden_version bigint, p_bed_id text, p_kind text, p_planned_date date, p_title text, p_notes text, p_completed_date date)
returns public.bed_activities language plpgsql security definer set search_path = '' as $$
declare garden public.gardens; activity public.bed_activities; body jsonb;
begin
  garden := public.myco_activity_garden(p_garden_id);
  if p_activity_id is null or p_kind is null or p_kind not in ('planting','mulch')
    or (p_planned_date is not null and p_planned_date not between date '0001-01-01' and date '9999-12-31')
    or p_title is null or length(btrim(p_title)) not between 1 and 120 or length(coalesce(p_notes,'')) > 2000 then
    raise exception 'Check activity details' using errcode = '22023'; end if;
  select a.* into activity from public.bed_activities a where a.id=p_activity_id for update;
  if found then
    if activity.garden_id <> garden.id then raise exception 'Activity is unavailable' using errcode = '42501'; end if;
    if p_activity_version is null and activity.actor_id = (select auth.uid()) and activity.bed_id=p_bed_id
      and activity.kind=p_kind and activity.planned_date is not distinct from p_planned_date and activity.title=btrim(p_title) and activity.notes=btrim(coalesce(p_notes,'')) then
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
      planned_snapshot=case when bed_id=p_bed_id then planned_snapshot else body end,source_version=case when bed_id=p_bed_id then source_version else garden.version end,version=version+1,updated_at=clock_timestamp() where id=activity.id returning * into activity;
  end if;
  if p_completed_date is not null then return public.complete_bed_activity(garden.id,activity.id,activity.version,garden.version,p_completed_date,p_notes); end if;
  return activity;
end;
$$;

-- Open work owns its bed draft. Saving it cannot change the current garden.
create function public.update_open_work_bed(p_garden_id uuid,p_activity_id uuid,p_activity_version bigint,p_bed jsonb)
returns public.bed_activities language plpgsql security definer set search_path = '' as $$
declare activity public.bed_activities; beds jsonb; body jsonb;
begin
  perform public.myco_activity_garden(p_garden_id);
  select a.* into activity from public.bed_activities a where a.id=p_activity_id and a.garden_id=p_garden_id for update;
  if not found then raise exception 'Work is unavailable' using errcode='P0002'; end if;
  if activity.status<>'planned' then raise exception 'Only open work can be edited' using errcode='22023'; end if;
  if p_activity_version is null or activity.version<>p_activity_version then raise exception 'Work changed' using errcode='40001'; end if;
  if jsonb_typeof(p_bed) is distinct from 'object' or p_bed->>'id' is distinct from activity.bed_id then
    raise exception 'Keep the same bed identity' using errcode='22023'; end if;
  select jsonb_agg(case when item->>'id'=activity.bed_id then p_bed else item end order by n) into beds
  from jsonb_array_elements(activity.planned_snapshot->'beds') with ordinality as b(item,n);
  body:=jsonb_set(activity.planned_snapshot,'{beds}',beds);
  if not public.myco_valid_garden_layout((body->'dimensions'->>'widthCm')::bigint,(body->'dimensions'->>'lengthCm')::bigint,beds)
    or not public.myco_valid_planting_plans(beds) or not public.myco_valid_mulch_plans(beds) then
    raise exception 'Invalid work bed plan' using errcode='23514'; end if;
  update public.bed_activities set planned_snapshot=body,version=version+1,updated_at=clock_timestamp()
  where id=activity.id returning * into activity;
  return activity;
end;
$$;

-- Applying the edited work, validating it against today's layout, and recording
-- completion are one transaction. Other beds are retained exactly as saved.
create function public.complete_planned_bed_activity(p_garden_id uuid,p_activity_id uuid,p_activity_version bigint,
  p_garden_version bigint,p_completed_date date,p_notes text)
returns public.bed_activities language plpgsql security definer set search_path = '' as $$
declare garden public.gardens; activity public.bed_activities; proposed jsonb; current_bed jsonb; replacement_beds jsonb; next_version bigint;
begin
  garden:=public.myco_activity_garden(p_garden_id);
  select a.* into activity from public.bed_activities a where a.id=p_activity_id and a.garden_id=garden.id for update;
  if not found then raise exception 'Work is unavailable' using errcode='P0002'; end if;
  if activity.status='completed' then
    return public.complete_bed_activity(garden.id,activity.id,p_activity_version,p_garden_version,p_completed_date,p_notes);
  end if;
  if activity.status<>'planned' then raise exception 'Work is not open' using errcode='22023'; end if;
  if p_activity_version is null or activity.version<>p_activity_version or p_garden_version is null or garden.version<>p_garden_version then
    raise exception 'Garden or work changed' using errcode='40001'; end if;
  select item into proposed from jsonb_array_elements(activity.planned_snapshot->'beds') item where item->>'id'=activity.bed_id;
  select item into current_bed from jsonb_array_elements(garden.beds) item where item->>'id'=activity.bed_id;
  if proposed is null or current_bed is null then
    raise exception 'Bed is no longer in the current garden' using errcode='P0002'; end if;
  proposed:=proposed||jsonb_build_object('xCm',current_bed->'xCm','yCm',current_bed->'yCm');
  select jsonb_agg(case when item->>'id'=activity.bed_id then proposed else item end order by n) into replacement_beds
  from jsonb_array_elements(garden.beds) with ordinality as b(item,n);
  update public.gardens set beds=replacement_beds where id=garden.id returning version into next_version;
  return public.complete_bed_activity(garden.id,activity.id,activity.version,next_version,p_completed_date,p_notes);
end;
$$;
revoke all on function public.update_open_work_bed(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.complete_planned_bed_activity(uuid,uuid,bigint,bigint,date,text) from public,anon,authenticated;
grant execute on function public.update_open_work_bed(uuid,uuid,bigint,jsonb) to authenticated;
grant execute on function public.complete_planned_bed_activity(uuid,uuid,bigint,bigint,date,text) to authenticated;
notify pgrst,'reload schema';
commit;

