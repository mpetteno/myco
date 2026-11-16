begin;

-- A bed checkpoint captures all bed contents. It has no planting/mulch category.
create function public.record_bed_changes(
  p_garden_id uuid,p_expected_version bigint,p_event_id uuid,p_bed_id text,
  p_event_date date,p_title text,p_notes text
)
returns public.garden_layout_events
language plpgsql security definer set search_path = '' as $$
declare garden public.gardens; existing public.garden_layout_events; result public.garden_layout_events;
begin
  garden:=public.myco_activity_garden(p_garden_id);
  if p_event_id is null or p_expected_version is null or p_expected_version<1
    or p_bed_id is null or length(btrim(p_bed_id)) not between 1 and 128
    or p_event_date is null or p_event_date not between date '0001-01-01' and date '9999-12-31'
    or p_title is null or length(btrim(p_title)) not between 1 and 120
    or length(coalesce(p_notes,''))>2000 then
    raise exception 'Check the bed, event date, title and notes' using errcode='22023';
  end if;
  select * into existing from public.garden_layout_events where id=p_event_id;
  if found then
    if existing.garden_id<>garden.id then raise exception 'Event is unavailable' using errcode='42501'; end if;
    if existing.deleted_at is not null then raise exception 'History entry is unavailable' using errcode='P0002'; end if;
    if existing.actor_id=(select auth.uid()) and existing.event_kind='bed' and existing.bed_id=p_bed_id
      and existing.event_date=p_event_date and existing.title=btrim(p_title)
      and existing.notes=btrim(coalesce(p_notes,'')) then return existing; end if;
    raise exception 'This event request has already been used' using errcode='22023';
  end if;
  if garden.version<>p_expected_version then raise exception 'Garden changed' using errcode='40001'; end if;
  if not exists(select 1 from jsonb_array_elements(garden.beds) item where item->>'id'=p_bed_id) then
    raise exception 'Choose an existing bed' using errcode='22023';
  end if;
  insert into public.garden_layout_events(id,garden_id,event_date,title,notes,source_version,snapshot,actor_id,event_kind,bed_id)
  values(p_event_id,garden.id,p_event_date,btrim(p_title),btrim(coalesce(p_notes,'')),garden.version,
    jsonb_build_object('name',garden.name,'dimensions',jsonb_build_object('widthCm',garden.width_cm,'lengthCm',garden.length_cm),'beds',garden.beds),
    (select auth.uid()),'bed',p_bed_id)
  returning * into result;
  return result;
end;
$$;
revoke all on function public.record_bed_changes(uuid,bigint,uuid,text,date,text,text) from public,anon,authenticated;
grant execute on function public.record_bed_changes(uuid,bigint,uuid,text,date,text,text) to authenticated;

notify pgrst,'reload schema';
commit;
