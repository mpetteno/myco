begin;

alter table public.garden_layout_events
  add column version bigint not null default 1,
  add column updated_at timestamptz not null default clock_timestamp(),
  add column updated_by uuid references auth.users(id) on delete set null,
  add column last_request_id uuid,
  add column display_snapshot jsonb;
alter table public.garden_layout_events drop constraint garden_layout_events_event_kind_check;
alter table public.garden_layout_events add constraint garden_layout_events_event_kind_check
  check (event_kind in ('layout','bed','planting','mulch'));

-- A bed completion confirms its bed only. Preserve the previously reconstructed
-- scene separately from the original captured proposal, before enabling edits.
create function public.myco_history_scene(base jsonb, body jsonb, kind text, bed_id text)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare target jsonb; beds jsonb; result jsonb;
begin
  if kind = 'layout' then return body; end if;
  select item into target from jsonb_array_elements(body->'beds') item where item->>'id' = bed_id;
  result := coalesce(base, jsonb_build_object('name',body->'name','dimensions',body->'dimensions','beds','[]'::jsonb));
  if target is null then return result; end if;
  select coalesce(jsonb_agg(item order by n),'[]'::jsonb) into beds
  from jsonb_array_elements(result->'beds') with ordinality as b(item,n) where item->>'id' <> bed_id;
  result := jsonb_set(result,'{beds}',beds || jsonb_build_array(target));
  result := jsonb_set(result,'{dimensions,widthCm}',to_jsonb(greatest((result#>>'{dimensions,widthCm}')::numeric,
    (target->>'xCm')::numeric+(target->>'widthCm')::numeric)));
  return jsonb_set(result,'{dimensions,lengthCm}',to_jsonb(greatest((result#>>'{dimensions,lengthCm}')::numeric,
    (target->>'yCm')::numeric+(target->>'lengthCm')::numeric)));
end;
$$;
revoke all on function public.myco_history_scene(jsonb,jsonb,text,text) from public,anon,authenticated;

do $freeze_history$
declare item public.garden_layout_events; previous jsonb; scene jsonb; garden uuid;
begin
  for item in select * from public.garden_layout_events order by garden_id,event_date,event_order loop
    if garden is distinct from item.garden_id then previous:=null; garden:=item.garden_id; end if;
    scene:=public.myco_history_scene(previous,item.snapshot,item.event_kind,item.bed_id);
    update public.garden_layout_events set display_snapshot=scene where id=item.id;
    previous:=scene;
  end loop;
end;
$freeze_history$;
alter table public.garden_layout_events alter column display_snapshot set not null;
alter table public.garden_layout_events add constraint garden_history_display_object check(jsonb_typeof(display_snapshot)='object');

create or replace function public.myco_history_insert_scene()
returns trigger language plpgsql security definer set search_path = '' as $$
declare previous jsonb;
begin
  if new.display_snapshot is null then
    select e.display_snapshot into previous from public.garden_layout_events e
    where e.garden_id=new.garden_id and (e.event_date,e.event_order)<(new.event_date,new.event_order)
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
create trigger garden_history_insert_scene before insert on public.garden_layout_events
for each row execute function public.myco_history_insert_scene();

create table public.garden_layout_event_revisions (
  event_id uuid not null references public.garden_layout_events(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  version bigint not null,
  previous_record jsonb not null,
  corrected_at timestamptz not null default clock_timestamp(),
  corrected_by uuid references auth.users(id) on delete set null,
  primary key(event_id,version)
);
alter table public.garden_layout_event_revisions enable row level security;
revoke all on public.garden_layout_event_revisions from public,anon,authenticated;
grant select on public.garden_layout_event_revisions to authenticated;
create policy garden_history_revisions_read on public.garden_layout_event_revisions for select to authenticated
using(exists(select 1 from public.gardens g where g.id=garden_id));

create function public.myco_valid_history_document(body jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare field text; value numeric; w bigint; l bigint;
begin
  if jsonb_typeof(body) is distinct from 'object' or jsonb_typeof(body->'name') is distinct from 'string'
    or length(btrim(body->>'name')) not between 1 and 100 or jsonb_typeof(body->'dimensions') is distinct from 'object' then return false; end if;
  foreach field in array array['widthCm','lengthCm'] loop
    if jsonb_typeof(body->'dimensions'->field) is distinct from 'number' then return false; end if;
    value:=(body->'dimensions'->>field)::numeric;
    if value<5 or value>9007199254740991 or mod(value,5)<>0 then return false; end if;
  end loop;
  w:=(body#>>'{dimensions,widthCm}')::bigint; l:=(body#>>'{dimensions,lengthCm}')::bigint;
  return public.myco_valid_garden_layout(w,l,body->'beds') and public.myco_valid_planting_plans(body->'beds')
    and public.myco_valid_mulch_plans(body->'beds');
exception when others then return false;
end;
$$;
revoke all on function public.myco_valid_history_document(jsonb) from public,anon,authenticated;

create function public.save_garden_history_event(
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
      where e.garden_id=garden.id and e.event_date<=p_event_date
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

notify pgrst,'reload schema';
commit;
