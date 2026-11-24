begin;

-- Dedicated administrator-only RPCs keep direct DELETE unavailable and preserve saved snapshots.

create or replace function public.myco_remove_plant_family(entry_id uuid, expected_version bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare loaded_version bigint; affected_calendars uuid[];
begin
  if not exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())) then
    raise exception 'Only catalogue administrators can remove entries' using errcode = '42501';
  end if;
  if entry_id is null or expected_version is null or expected_version < 1 then
    raise exception 'Choose a loaded catalogue entry' using errcode = '22023';
  end if;
  select version into loaded_version from public.plant_families where id = entry_id for update;
  if not found or loaded_version <> expected_version then
    raise exception 'Entry changed or was removed; refresh before removing' using errcode = '40001';
  end if;
  -- Foreign keys also reject families referenced by crops or relationship rules.
  delete from public.plant_families where id = entry_id;
end;
$$;
revoke all on function public.myco_remove_plant_family(uuid,bigint) from public, anon;
grant execute on function public.myco_remove_plant_family(uuid,bigint) to authenticated;

create or replace function public.myco_remove_plant_type(entry_id uuid, expected_version bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare loaded_version bigint; affected_calendars uuid[];
begin
  if not exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())) then
    raise exception 'Only catalogue administrators can remove entries' using errcode = '42501';
  end if;
  if entry_id is null or expected_version is null or expected_version < 1 then
    raise exception 'Choose a loaded catalogue entry' using errcode = '22023';
  end if;
  select version into loaded_version from public.plant_types where id = entry_id for update;
  if not found or loaded_version <> expected_version then
    raise exception 'Entry changed or was removed; refresh before removing' using errcode = '40001';
  end if;
  if exists (select 1 from public.plant_cultivars where plant_type_id = entry_id)
    or exists (select 1 from public.seed_mixture_components where plant_type_id = entry_id)
    or exists (select 1 from public.mulch_types where plant_type_id = entry_id) then
    raise exception 'Crop is used by cultivars, seed mixtures or living mulch' using errcode = '23503';
  end if;
  select array_agg(distinct calendar_profile_id) into affected_calendars
    from public.plant_calendar_entries where plant_type_id = entry_id;
  delete from public.calendar_windows where calendar_entry_id in (select id from public.plant_calendar_entries where plant_type_id = entry_id);
  delete from public.plant_calendar_entries where plant_type_id = entry_id;
  delete from public.plant_depths where plant_type_id = entry_id;
  delete from public.plant_guidance where plant_type_id = entry_id;
  delete from public.companion_rules where plant_a_id = entry_id or plant_b_id = entry_id;
  delete from public.rotation_rules where current_plant_id = entry_id or previous_plant_id = entry_id;
  -- Retain imported source rows and their decisions as provenance after crop removal.
  update public.catalogue_import_sources set plant_type_id = null where plant_type_id = entry_id;
  delete from public.plant_types where id = entry_id;
  update public.calendar_profiles set notes = notes where id = any(affected_calendars);
end;
$$;
revoke all on function public.myco_remove_plant_type(uuid,bigint) from public, anon;
grant execute on function public.myco_remove_plant_type(uuid,bigint) to authenticated;

create or replace function public.myco_remove_seed_mixture(entry_id uuid, expected_version bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare loaded_version bigint; affected_calendars uuid[];
begin
  if not exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())) then
    raise exception 'Only catalogue administrators can remove entries' using errcode = '42501';
  end if;
  if entry_id is null or expected_version is null or expected_version < 1 then
    raise exception 'Choose a loaded catalogue entry' using errcode = '22023';
  end if;
  select version into loaded_version from public.seed_mixtures where id = entry_id for update;
  if not found or loaded_version <> expected_version then
    raise exception 'Entry changed or was removed; refresh before removing' using errcode = '40001';
  end if;
  -- Components cascade; saved garden mixtures are independent snapshots.
  delete from public.seed_mixtures where id = entry_id;
end;
$$;
revoke all on function public.myco_remove_seed_mixture(uuid,bigint) from public, anon;
grant execute on function public.myco_remove_seed_mixture(uuid,bigint) to authenticated;

create or replace function public.myco_remove_mulch_category(entry_id uuid, expected_version bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare loaded_version bigint; affected_calendars uuid[];
begin
  if not exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())) then
    raise exception 'Only catalogue administrators can remove entries' using errcode = '42501';
  end if;
  if entry_id is null or expected_version is null or expected_version < 1 then
    raise exception 'Choose a loaded catalogue entry' using errcode = '22023';
  end if;
  select version into loaded_version from public.mulch_categories where id = entry_id for update;
  if not found or loaded_version <> expected_version then
    raise exception 'Entry changed or was removed; refresh before removing' using errcode = '40001';
  end if;
  if exists (select 1 from public.mulch_categories where id = entry_id and code = 'living')
    and (exists (select 1 from public.plant_types where living_mulch_enabled)
      or exists (select 1 from public.plant_cultivars c join public.plant_types p on p.id = c.plant_type_id where coalesce(c.living_mulch_enabled, p.living_mulch_enabled))) then
    raise exception 'Category is used by enabled living-mulch plants' using errcode = '23503';
  end if;
  -- Foreign keys reject categories with stored organic, synthetic or legacy living materials.
  delete from public.mulch_categories where id = entry_id;
end;
$$;
revoke all on function public.myco_remove_mulch_category(uuid,bigint) from public, anon;
grant execute on function public.myco_remove_mulch_category(uuid,bigint) to authenticated;

notify pgrst, 'reload schema';
commit;
