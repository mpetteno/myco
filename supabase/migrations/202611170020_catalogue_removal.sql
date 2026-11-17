begin;

-- Keep direct DELETE unavailable. These two operations check role and revision,
-- and never edit saved garden, activity or history snapshots.
create function public.myco_remove_mulch_type(entry_id uuid, expected_version bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.catalogue_administrators where user_id = (select auth.uid())
  ) then
    raise exception 'Only catalogue administrators can remove entries' using errcode = '42501';
  end if;
  if entry_id is null or expected_version is null or expected_version < 1 then
    raise exception 'Choose a loaded catalogue entry' using errcode = '22023';
  end if;

  delete from public.mulch_types
  where id = entry_id and version = expected_version;
  if not found then
    raise exception 'Entry changed or was removed; refresh before removing' using errcode = '40001';
  end if;
end;
$$;

create function public.myco_remove_cultivar(entry_id uuid, expected_version bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  loaded_version bigint;
  affected_calendars uuid[];
begin
  if not exists (
    select 1 from public.catalogue_administrators where user_id = (select auth.uid())
  ) then
    raise exception 'Only catalogue administrators can remove entries' using errcode = '42501';
  end if;
  if entry_id is null or expected_version is null or expected_version < 1 then
    raise exception 'Choose a loaded catalogue entry' using errcode = '22023';
  end if;

  select version into loaded_version
  from public.plant_cultivars
  where id = entry_id
  for update;
  if not found or loaded_version <> expected_version then
    raise exception 'Entry changed or was removed; refresh before removing' using errcode = '40001';
  end if;
  if exists (select 1 from public.mulch_types where cultivar_id = entry_id) then
    raise exception 'Cultivar is referenced by a living mulch type' using errcode = '23503';
  end if;

  select array_agg(distinct calendar_profile_id) into affected_calendars
  from public.plant_calendar_entries
  where cultivar_id = entry_id;

  delete from public.calendar_windows
  where calendar_entry_id in (
    select id from public.plant_calendar_entries where cultivar_id = entry_id
  );
  delete from public.plant_calendar_entries where cultivar_id = entry_id;
  delete from public.plant_depths where cultivar_id = entry_id;
  delete from public.plant_guidance where cultivar_id = entry_id;
  delete from public.plant_cultivars where id = entry_id;

  update public.calendar_profiles set notes = notes
  where id = any(affected_calendars);
end;
$$;

revoke all on function public.myco_remove_mulch_type(uuid,bigint) from public, anon;
revoke all on function public.myco_remove_cultivar(uuid,bigint) from public, anon;
grant execute on function public.myco_remove_mulch_type(uuid,bigint) to authenticated;
grant execute on function public.myco_remove_cultivar(uuid,bigint) to authenticated;

notify pgrst, 'reload schema';
commit;
