begin;

-- Retain deleted records for audit and safe retries; never rewrite later snapshots.
alter table public.garden_layout_events
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id) on delete set null;
alter table public.garden_layout_event_revisions
  add column action text not null default 'correction' check(action in ('correction','deletion'));

create function public.delete_garden_history_event(
  p_garden_id uuid,p_event_id uuid,p_event_version bigint,p_request_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare garden public.gardens; existing public.garden_layout_events;
begin
  garden:=public.myco_activity_garden(p_garden_id);
  if p_request_id is null or p_event_version is null or p_event_version<1 then
    raise exception 'Check the deletion request' using errcode='22023';
  end if;
  select * into existing from public.garden_layout_events where id=p_event_id and garden_id=garden.id for update;
  if not found then raise exception 'History entry is unavailable' using errcode='P0002'; end if;
  if existing.deleted_at is not null then
    if existing.last_request_id=p_request_id then return; end if;
    raise exception 'History entry is unavailable' using errcode='P0002';
  end if;
  if existing.version<>p_event_version then raise exception 'History record changed' using errcode='40001'; end if;
  insert into public.garden_layout_event_revisions(event_id,garden_id,version,previous_record,corrected_by,action)
  values(existing.id,garden.id,existing.version,to_jsonb(existing),(select auth.uid()),'deletion');
  update public.garden_layout_events set deleted_at=clock_timestamp(),deleted_by=(select auth.uid()),
    version=version+1,updated_at=clock_timestamp(),updated_by=(select auth.uid()),last_request_id=p_request_id
  where id=existing.id;
end;
$$;
revoke all on function public.delete_garden_history_event(uuid,uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.delete_garden_history_event(uuid,uuid,bigint,uuid) to authenticated;

create or replace function public.myco_history_insert_scene()
returns trigger language plpgsql security definer set search_path = '' as $$
declare previous jsonb;
begin
  if new.display_snapshot is null then
    select e.display_snapshot into previous from public.garden_layout_events e
    where e.deleted_at is null and e.garden_id=new.garden_id and (e.event_date,e.event_order)<(new.event_date,new.event_order)
    order by e.event_date desc,e.event_order desc limit 1;
    new.display_snapshot:=public.myco_history_scene(previous,new.snapshot,new.event_kind,new.bed_id);
  end if;
  if not public.myco_valid_history_document(new.display_snapshot) then
    raise exception 'Bed conflicts with the recorded garden layout' using errcode='P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.myco_history_insert_scene() from public,anon,authenticated;

create or replace function public.save_garden_history_event(
  p_garden_id uuid,p_event_id uuid,p_event_version bigint,p_request_id uuid,
  p_event_date date,p_title text,p_notes text,p_document jsonb,p_kind text,p_bed_id text
)
returns public.garden_layout_events language plpgsql security definer set search_path = '' as $$
declare garden public.gardens; existing public.garden_layout_events; result public.garden_layout_events; previous jsonb; scene jsonb;
begin
  garden:=public.myco_activity_garden(p_garden_id);
  if p_event_id is null or p_request_id is null or p_event_date is null
    or p_event_date not between date '0001-01-01' and date '9999-12-31'
    or p_title is null or length(btrim(p_title)) not between 1 and 120 or length(coalesce(p_notes,''))>2000
    or not public.myco_valid_history_document(p_document)
    or p_kind is null or p_kind not in ('layout','bed','planting','mulch')
    or (p_kind='layout' and p_bed_id is not null)
    or (p_kind<>'layout' and (p_bed_id is null or length(btrim(p_bed_id)) not between 1 and 128
      or not exists(select 1 from jsonb_array_elements(p_document->'beds') item where item->>'id'=p_bed_id))) then
    raise exception 'Check the historical document, scope and event details' using errcode='22023';
  end if;
  select * into existing from public.garden_layout_events where id=p_event_id for update;
  if found then
    if existing.garden_id<>garden.id then raise exception 'Event is unavailable' using errcode='42501'; end if;
    if existing.deleted_at is not null then raise exception 'History entry is unavailable' using errcode='P0002'; end if;
    if existing.last_request_id=p_request_id then
      if existing.event_date=p_event_date and existing.title=btrim(p_title) and existing.notes=btrim(coalesce(p_notes,''))
        and existing.snapshot=p_document and existing.event_kind=p_kind and existing.bed_id is not distinct from p_bed_id then return existing; end if;
      raise exception 'This request was already used' using errcode='22023';
    end if;
    if p_event_version is null or existing.version<>p_event_version then raise exception 'History record changed' using errcode='40001'; end if;
    if existing.event_kind<>p_kind or existing.bed_id is distinct from p_bed_id then
      raise exception 'Keep the original event scope' using errcode='22023';
    end if;
    if p_kind<>'layout' and (
      p_document->'name' is distinct from existing.display_snapshot->'name'
      or p_document->'dimensions' is distinct from existing.display_snapshot->'dimensions'
      or (select coalesce(jsonb_agg(item order by item->>'id'),'[]'::jsonb) from jsonb_array_elements(p_document->'beds') item where item->>'id'<>p_bed_id)
        is distinct from (select coalesce(jsonb_agg(item order by item->>'id'),'[]'::jsonb) from jsonb_array_elements(existing.display_snapshot->'beds') item where item->>'id'<>p_bed_id)
    ) then raise exception 'A bed record can change only its own bed' using errcode='22023'; end if;
    insert into public.garden_layout_event_revisions(event_id,garden_id,version,previous_record,corrected_by)
    values(existing.id,garden.id,existing.version,to_jsonb(existing),(select auth.uid()));
    update public.garden_layout_events set event_date=p_event_date,title=btrim(p_title),notes=btrim(coalesce(p_notes,'')),
      snapshot=p_document,display_snapshot=p_document,version=version+1,updated_at=clock_timestamp(),updated_by=(select auth.uid()),last_request_id=p_request_id
    where id=existing.id returning * into result;
    if existing.activity_id is not null then
      update public.bed_activities set title=result.title,completed_date=result.event_date,completed_notes=result.notes,
        version=version+1,updated_at=clock_timestamp() where id=existing.activity_id and status='completed';
    end if;
  else
    if p_event_version is not null then raise exception 'History record is unavailable' using errcode='P0002'; end if;
    if p_kind not in ('layout','bed') then raise exception 'Choose garden or bed scope for a new record' using errcode='22023'; end if;
    scene:=p_document;
    if p_kind='bed' then
      select e.display_snapshot into previous from public.garden_layout_events e
      where e.deleted_at is null and e.garden_id=garden.id and e.event_date<=p_event_date
      order by e.event_date desc,e.event_order desc limit 1;
      scene:=public.myco_history_scene(previous,p_document,p_kind,p_bed_id);
      if not public.myco_valid_history_document(scene) then
        raise exception 'Bed conflicts with the recorded garden on this date' using errcode='23514';
      end if;
    end if;
    insert into public.garden_layout_events(id,garden_id,event_date,title,notes,source_version,snapshot,display_snapshot,
      actor_id,event_kind,bed_id,last_request_id)
    values(p_event_id,garden.id,p_event_date,btrim(p_title),btrim(coalesce(p_notes,'')),garden.version,p_document,scene,
      (select auth.uid()),p_kind,p_bed_id,p_request_id) returning * into result;
  end if;
  return result;
end;
$$;
revoke all on function public.save_garden_history_event(uuid,uuid,bigint,uuid,date,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.save_garden_history_event(uuid,uuid,bigint,uuid,date,text,text,jsonb,text,text) to authenticated;


create or replace function public.record_garden_layout_event(
  p_garden_id uuid, p_expected_version bigint, p_event_id uuid,
  p_event_date date, p_title text, p_notes text
)
returns public.garden_layout_events
language plpgsql security definer set search_path = '' as $$
declare
  garden public.gardens;
  existing public.garden_layout_events;
  result public.garden_layout_events;
begin
  select g.* into garden
  from public.gardens g
  where g.id = p_garden_id and (
    g.owner_id = (select auth.uid()) or exists (
      select 1 from public.garden_members m
      where m.garden_id = g.id and m.user_id = (select auth.uid())
    )
  ) for update;
  if not found then
    raise exception 'Garden is unavailable or access was removed' using errcode = '42501';
  end if;
  if p_event_id is null or p_expected_version is null or p_expected_version < 1
    or p_event_date is null or p_event_date not between date '0001-01-01' and date '9999-12-31'
    or p_title is null or length(btrim(p_title)) not between 1 and 120
    or length(coalesce(p_notes, '')) > 2000 then
    raise exception 'Check the event date, title and notes' using errcode = '22023';
  end if;
  select e.* into existing from public.garden_layout_events e where e.id = p_event_id;
  if found then
    if existing.deleted_at is not null then raise exception 'History entry is unavailable' using errcode='P0002'; end if;
    if existing.garden_id = p_garden_id and existing.actor_id = (select auth.uid())
      and existing.event_date = p_event_date and existing.title = btrim(p_title)
      and existing.notes = btrim(coalesce(p_notes, '')) then
      return existing;
    end if;
    raise exception 'This event request has already been used' using errcode = '22023';
  end if;
  if garden.version <> p_expected_version then
    raise exception 'Garden changed before the event could be recorded' using errcode = '40001';
  end if;
  insert into public.garden_layout_events(id, garden_id, event_date, title, notes, source_version, snapshot, actor_id)
  values (p_event_id, garden.id, p_event_date, btrim(p_title), btrim(coalesce(p_notes, '')), garden.version,
    jsonb_build_object('name', garden.name,
      'dimensions', jsonb_build_object('widthCm', garden.width_cm, 'lengthCm', garden.length_cm),
      'beds', garden.beds), (select auth.uid()))
  returning * into result;
  return result;
end;
$$;
revoke all on function public.record_garden_layout_event(uuid, bigint, uuid, date, text, text) from public, anon, authenticated;
grant execute on function public.record_garden_layout_event(uuid, bigint, uuid, date, text, text) to authenticated;


-- Retire the separate proposal workflow. Existing copies remain in the database
-- as legacy data; no pending copy is applied to a user's current plan.
revoke all on public.bed_activities from public,anon,authenticated;
revoke all on function public.save_bed_activity(uuid,uuid,bigint,bigint,text,text,date,text,text,date) from public,anon,authenticated;
revoke all on function public.complete_bed_activity(uuid,uuid,bigint,bigint,date,text) from public,anon,authenticated;
revoke all on function public.cancel_bed_activity(uuid,uuid,bigint) from public,anon,authenticated;
revoke all on function public.update_open_work_bed(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.complete_planned_bed_activity(uuid,uuid,bigint,bigint,date,text) from public,anon,authenticated;

-- Capture a completed bed checkpoint atomically, without applying a separate plan.
create function public.record_completed_bed_activity(
  p_garden_id uuid,p_garden_version bigint,p_activity_id uuid,p_bed_id text,
  p_kind text,p_completed_date date,p_title text,p_notes text
)
returns public.bed_activities language plpgsql security definer set search_path = '' as $$
declare garden public.gardens; existing public.bed_activities; result public.bed_activities;
begin
  garden:=public.myco_activity_garden(p_garden_id);
  if p_completed_date is null or p_completed_date not between date '0001-01-01' and date '9999-12-31' then
    raise exception 'Choose an actual completion date' using errcode='22023';
  end if;
  select * into existing from public.bed_activities where id=p_activity_id for update;
  if found then
    if existing.garden_id<>garden.id then raise exception 'Activity is unavailable' using errcode='42501'; end if;
    if existing.status<>'completed' then raise exception 'This request belongs to legacy work' using errcode='22023'; end if;
    if exists(select 1 from public.garden_layout_events where id=existing.completion_event_id and deleted_at is not null) then
      raise exception 'History entry is unavailable' using errcode='P0002';
    end if;
  end if;
  result:=public.save_bed_activity(garden.id,p_activity_id,null,p_garden_version,p_bed_id,p_kind,null,p_title,p_notes,p_completed_date);
  if result.status<>'completed' then raise exception 'Completion was not recorded' using errcode='22023'; end if;
  return result;
end;
$$;
revoke all on function public.record_completed_bed_activity(uuid,bigint,uuid,text,text,date,text,text) from public,anon,authenticated;
grant execute on function public.record_completed_bed_activity(uuid,bigint,uuid,text,text,date,text,text) to authenticated;

notify pgrst,'reload schema';
commit;
