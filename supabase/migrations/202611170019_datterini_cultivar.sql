begin;

-- Convert this deployment's legacy Tomatoes -> Datterini entry. Saved planting
-- references are self-contained JSON snapshots, not foreign keys to these rows.
-- Reuse the old crop ID for the cultivar; never rewrite garden or history JSON.
do $datterini_cultivar$
declare
  legacy_id constant uuid := '89764aeb-96fc-4215-8950-93ac3653b61d';
  legacy_crop public.plant_types;
  legacy_family public.plant_families;
  tomato public.plant_types;
  gardens_before jsonb;
  history_before jsonb;
  revisions_before jsonb;
  activities_before jsonb;
begin
  perform set_config('lock_timeout', '10s', true);

  select * into legacy_crop
  from public.plant_types
  where id = legacy_id
  for update;

  -- Fresh databases have no legacy entry. A completed conversion is a no-op.
  if not found then return; end if;
  if legacy_crop.name <> 'Datterini' or legacy_crop.scientific_name <> '' then
    raise exception 'Legacy Datterini changed; review before converting';
  end if;

  select * into strict legacy_family
  from public.plant_families
  where id = legacy_crop.family_id
  for update;

  if legacy_family.id <> '3707ce5a-e28e-43e1-b70d-1b1d5a718bbb'::uuid
      or legacy_family.name <> 'Tomatoes' or legacy_family.notes <> '' then
    raise exception 'Legacy Tomatoes family changed; review before removing';
  end if;
  if exists (
    select 1 from public.plant_types
    where family_id = legacy_family.id and id <> legacy_id
  ) then
    raise exception 'Tomatoes contains other crops; refusing to remove the family';
  end if;

  select p.* into strict tomato
  from public.plant_types p
  join public.plant_families f on f.id = p.family_id
  where p.name = 'Tomato' and f.name = 'Solanaceae'
  for update of p, f;

  if exists (
    select 1 from public.plant_cultivars
    where id = legacy_id
      or (plant_type_id = tomato.id and lower(btrim(name)) = 'datterini')
  ) then
    raise exception 'A Datterini cultivar already exists; review before merging';
  end if;

  -- These references were absent at preflight. Stop rather than discard or
  -- broaden any newly added crop-specific guidance or relationships.
  if exists (select 1 from public.plant_cultivars where plant_type_id = legacy_id)
      or exists (select 1 from public.plant_guidance where plant_type_id = legacy_id)
      or exists (select 1 from public.plant_depths where plant_type_id = legacy_id)
      or exists (select 1 from public.plant_calendar_entries where plant_type_id = legacy_id)
      or exists (select 1 from public.catalogue_import_sources where plant_type_id = legacy_id)
      or exists (select 1 from public.mulch_types where plant_type_id = legacy_id)
      or exists (
        select 1 from public.companion_rules
        where plant_a_id = legacy_id or plant_b_id = legacy_id
          or family_a_id = legacy_family.id or family_b_id = legacy_family.id
      ) or exists (
        select 1 from public.rotation_rules
        where current_plant_id = legacy_id or previous_plant_id = legacy_id
          or current_family_id = legacy_family.id or previous_family_id = legacy_family.id
      ) then
    raise exception 'Legacy catalogue references changed; migrate them before converting';
  end if;
  if exists (
    select 1 from pg_catalog.pg_constraint
    where contype = 'f' and confdeltype in ('c', 'n', 'd')
      and confrelid in ('public.plant_types'::regclass, 'public.plant_families'::regclass)
  ) then
    raise exception 'Unexpected cascading catalogue reference; review before deleting';
  end if;

  select coalesce(jsonb_agg(to_jsonb(g) order by g.id), '[]'::jsonb)
  into gardens_before from public.gardens g;
  select coalesce(jsonb_agg(to_jsonb(h) order by h.id), '[]'::jsonb)
  into history_before from public.garden_layout_events h;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.event_id, r.version), '[]'::jsonb)
  into revisions_before from public.garden_layout_event_revisions r;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
  into activities_before from public.bed_activities a;

  insert into public.plant_cultivars (
    id, plant_type_id, name, notes, plant_spacing_cm, row_spacing_cm,
    border_distance_cm, living_mulch_enabled, version, created_at, updated_at
  ) values (
    legacy_id, tomato.id, legacy_crop.name, legacy_crop.notes,
    coalesce(legacy_crop.plant_spacing_cm, legacy_family.plant_spacing_cm),
    coalesce(legacy_crop.row_spacing_cm, legacy_family.row_spacing_cm),
    legacy_crop.border_distance_cm, legacy_crop.living_mulch_enabled,
    legacy_crop.version, legacy_crop.created_at, clock_timestamp()
  );

  delete from public.plant_types where id = legacy_id;
  delete from public.plant_families where id = legacy_family.id;

  if (select coalesce(jsonb_agg(to_jsonb(g) order by g.id), '[]'::jsonb) from public.gardens g)
      is distinct from gardens_before
    or (select coalesce(jsonb_agg(to_jsonb(h) order by h.id), '[]'::jsonb) from public.garden_layout_events h)
      is distinct from history_before
    or (select coalesce(jsonb_agg(to_jsonb(r) order by r.event_id, r.version), '[]'::jsonb) from public.garden_layout_event_revisions r)
      is distinct from revisions_before
    or (select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb) from public.bed_activities a)
      is distinct from activities_before then
    raise exception 'Garden plans, history or activities changed; rolling back';
  end if;
end;
$datterini_cultivar$;

commit;
