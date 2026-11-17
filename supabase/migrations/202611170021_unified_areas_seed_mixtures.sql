begin;

-- A mixture composes catalogue crops/cultivars. All composition writes are
-- atomic, version checked and restricted to catalogue administrators.
create table public.seed_mixtures (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  notes text not null default '' check (length(notes) <= 2000),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index seed_mixtures_name_idx on public.seed_mixtures(lower(btrim(name)));
create trigger seed_mixtures_version before update on public.seed_mixtures
for each row execute function public.myco_version_catalogue_entry();

create table public.seed_mixture_components (
  id uuid primary key default gen_random_uuid(),
  mixture_id uuid not null references public.seed_mixtures(id) on delete cascade,
  plant_type_id uuid not null references public.plant_types(id),
  cultivar_id uuid,
  weight_percent numeric not null check (weight_percent > 0 and weight_percent <= 100),
  position integer not null check (position between 0 and 49),
  foreign key(cultivar_id,plant_type_id) references public.plant_cultivars(id,plant_type_id),
  unique nulls not distinct(mixture_id,plant_type_id,cultivar_id),
  unique(mixture_id,position)
);
alter table public.seed_mixtures enable row level security;
alter table public.seed_mixture_components enable row level security;
revoke all on public.seed_mixtures, public.seed_mixture_components from public, anon, authenticated;
grant select on public.seed_mixtures, public.seed_mixture_components to authenticated;
create policy seed_mixtures_read on public.seed_mixtures for select to authenticated using (true);
create policy seed_mixture_components_read on public.seed_mixture_components for select to authenticated using (true);

create function public.myco_check_mixture_total() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid; total numeric; component_count integer;
begin
  if tg_table_name = 'seed_mixtures' then target := new.id;
  elsif tg_op = 'DELETE' then target := old.mixture_id;
  else target := new.mixture_id; end if;
  if not exists (select 1 from public.seed_mixtures where id=target) then return null; end if;
  select sum(weight_percent), count(*) into total, component_count
  from public.seed_mixture_components where mixture_id=target;
  if component_count not between 1 and 50 or total is null or abs(total-100) > 0.000001 then
    raise exception 'Mixture percentages by weight must total 100%%' using errcode='23514';
  end if;
  if tg_op='UPDATE' and tg_table_name='seed_mixture_components' then
    if old.mixture_id <> new.mixture_id and exists (select 1 from public.seed_mixtures where id=old.mixture_id) then
      select sum(weight_percent), count(*) into total, component_count
      from public.seed_mixture_components where mixture_id=old.mixture_id;
      if component_count not between 1 and 50 or total is null or abs(total-100) > 0.000001 then
        raise exception 'Mixture percentages by weight must total 100%%' using errcode='23514';
      end if;
    end if;
  end if;
  return null;
end; $$;
revoke all on function public.myco_check_mixture_total() from public, anon, authenticated;
create constraint trigger seed_mixture_total after insert or update on public.seed_mixtures
  deferrable initially deferred for each row execute function public.myco_check_mixture_total();
create constraint trigger seed_mixture_component_total after insert or update or delete on public.seed_mixture_components
  deferrable initially deferred for each row execute function public.myco_check_mixture_total();

create function public.myco_save_seed_mixture(mixture_id uuid, expected_version bigint, details jsonb, components jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid; item jsonb; n integer := 0; loaded_version bigint; total numeric;
begin
  if not exists (select 1 from public.catalogue_administrators where user_id=(select auth.uid())) then
    raise exception 'Only catalogue administrators can manage seed mixtures' using errcode='42501';
  end if;
  if jsonb_typeof(details) is distinct from 'object' or jsonb_typeof(details->'name') is distinct from 'string'
    or jsonb_typeof(details->'notes') is distinct from 'string'
    or jsonb_typeof(components) is distinct from 'array' then
    raise exception 'Invalid seed mixture' using errcode='23514';
  end if;
  if jsonb_array_length(components) not between 1 and 50 then raise exception 'Use 1 to 50 components' using errcode='23514'; end if;
  for item in select jsonb_array_elements(components) loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'plant_type_id') is distinct from 'string'
      or jsonb_typeof(item->'cultivar_id') not in ('string','null')
      or jsonb_typeof(item->'weight_percent') is distinct from 'number'
      or (item->>'weight_percent')::numeric <= 0 or (item->>'weight_percent')::numeric > 100 then
      raise exception 'Invalid mixture component' using errcode='23514';
    end if;
  end loop;
  select sum((value->>'weight_percent')::numeric) into total from jsonb_array_elements(components);
  if abs(total-100)>0.000001 then raise exception 'Mixture percentages must total 100%%' using errcode='23514'; end if;
  if mixture_id is null then
    if expected_version is not null then raise exception 'Invalid mixture revision' using errcode='23514'; end if;
    insert into public.seed_mixtures(name,notes) values(btrim(details->>'name'),btrim(details->>'notes')) returning id into target;
  else
    select version into loaded_version from public.seed_mixtures where id=mixture_id for update;
    if not found or expected_version is null or loaded_version <> expected_version then
      raise exception 'Mixture changed; refresh before editing' using errcode='40001';
    end if;
    target := mixture_id;
    update public.seed_mixtures set name=btrim(details->>'name'),notes=btrim(details->>'notes') where id=target;
    delete from public.seed_mixture_components c where c.mixture_id=target;
  end if;
  for item in select jsonb_array_elements(components) loop
    insert into public.seed_mixture_components(mixture_id,plant_type_id,cultivar_id,weight_percent,position)
    values(target,(item->>'plant_type_id')::uuid,(item->>'cultivar_id')::uuid,(item->>'weight_percent')::numeric,n);
    n := n + 1;
  end loop;
  return target;
end; $$;
revoke all on function public.myco_save_seed_mixture(uuid,bigint,jsonb,jsonb) from public, anon;
grant execute on function public.myco_save_seed_mixture(uuid,bigint,jsonb,jsonb) to authenticated;

-- Snapshots deliberately do not require live catalogue records.
create function public.myco_valid_plant_snapshot(plant jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare field text; value numeric;
begin
  if jsonb_typeof(plant) is distinct from 'object' then return false; end if;
  foreach field in array array['id','name','familyId','familyName'] loop
    if jsonb_typeof(plant->field) is distinct from 'string' or length(btrim(plant->>field)) not between 1 and 128 then return false; end if;
  end loop;
  foreach field in array array['typeVersion','familyVersion'] loop
    if jsonb_typeof(plant->field) is distinct from 'number' then return false; end if;
    value := (plant->>field)::numeric;
    if value < 1 or value <> trunc(value) or value > 9007199254740991 then return false; end if;
  end loop;
  foreach field in array array['plantSpacingCm','rowSpacingCm'] loop
    if jsonb_typeof(plant->field)='null' then continue; end if;
    if jsonb_typeof(plant->field) is distinct from 'number' then return false; end if;
    value := (plant->>field)::numeric;
    if value <= 0 or value > 9007199254740991 then return false; end if;
  end loop;
  if plant ? 'borderDistanceCm' then
    if jsonb_typeof(plant->'borderDistanceCm') is distinct from 'number' then return false; end if;
    value := (plant->>'borderDistanceCm')::numeric;
    if value < 5 or value > 9007199254740991 or mod(value,5)<>0 then return false; end if;
  end if;
  if plant ?| array['cultivarId','cultivarName','cultivarVersion'] then
    if jsonb_typeof(plant->'cultivarId') is distinct from 'string' or length(btrim(plant->>'cultivarId')) not between 1 and 128
      or jsonb_typeof(plant->'cultivarName') is distinct from 'string' or length(btrim(plant->>'cultivarName')) not between 1 and 100
      or jsonb_typeof(plant->'cultivarVersion') is distinct from 'number' then return false; end if;
    value := (plant->>'cultivarVersion')::numeric;
    if value < 1 or value <> trunc(value) or value > 9007199254740991 then return false; end if;
  end if;
  return true;
end; $$;

-- Preserve the row geometry validator for legacy history and for projections of
-- row areas. The public entry point now also checks the unified area document.
alter function public.myco_valid_planting_plans(jsonb) rename to myco_valid_legacy_planting_plans;
create function public.myco_valid_area_plans(beds jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare bed jsonb; plan jsonb; area jsonb; other jsonb; component jsonb; mixture jsonb; layer jsonb;
  field text; value numeric; w numeric; l numeric; rows jsonb; covers jsonb; cover jsonb; total numeric;
  area_ids text[]; layer_ids text[]; component_keys text[]; component_key text;
begin
  if jsonb_typeof(beds) is distinct from 'array' then return false; end if;
  for bed in select jsonb_array_elements(beds) loop
    if not (bed ? 'areaPlan') then continue; end if;
    if bed ? 'plantingPlan' or bed ? 'mulchPlan' then return false; end if;
    plan := bed->'areaPlan';
    if jsonb_typeof(plan) is distinct from 'object' or plan->'version' is distinct from '1'::jsonb
      or jsonb_typeof(plan->'respectAreaSpacing') is distinct from 'boolean'
      or jsonb_typeof(plan->'areas') is distinct from 'array'
      or jsonb_typeof(bed->'widthCm') is distinct from 'number' or jsonb_typeof(bed->'lengthCm') is distinct from 'number' then return false; end if;
    if jsonb_array_length(plan->'areas')>12 then return false; end if;
    w := (bed->>'widthCm')::numeric; l := (bed->>'lengthCm')::numeric;
    area_ids := array[]::text[]; layer_ids := array[]::text[]; rows := '[]'::jsonb; covers := '[]'::jsonb;
    for area in select jsonb_array_elements(plan->'areas') loop
      if jsonb_typeof(area) is distinct from 'object' or jsonb_typeof(area->'id') is distinct from 'string'
        or length(btrim(area->>'id')) not between 1 and 128 or area->>'id'=any(area_ids)
        or jsonb_typeof(area->'name') is distinct from 'string' or length(area->>'name')>100
        or coalesce(area->>'kind','') not in ('rows','broadcast','unplanted')
        or coalesce(area->>'purpose','') not in ('crop','green_manure')
        or jsonb_typeof(area->'mulch') is distinct from 'array' then return false; end if;
      foreach field in array array['xCm','yCm','widthCm','lengthCm'] loop
        if jsonb_typeof(area->field) is distinct from 'number' then return false; end if;
        value := (area->>field)::numeric;
        if value < 0 or value > 9007199254740991 or mod(value,5)<>0 then return false; end if;
      end loop;
      if (area->>'widthCm')::numeric<5 or (area->>'lengthCm')::numeric<5
        or (area->>'xCm')::numeric+(area->>'widthCm')::numeric>w or (area->>'yCm')::numeric+(area->>'lengthCm')::numeric>l then return false; end if;
      for other in select jsonb_array_elements(plan->'areas') loop
        if other->>'id'=any(area_ids)
          and (area->>'xCm')::numeric < (other->>'xCm')::numeric+(other->>'widthCm')::numeric
          and (area->>'xCm')::numeric+(area->>'widthCm')::numeric > (other->>'xCm')::numeric
          and (area->>'yCm')::numeric < (other->>'yCm')::numeric+(other->>'lengthCm')::numeric
          and (area->>'yCm')::numeric+(area->>'lengthCm')::numeric > (other->>'yCm')::numeric then return false; end if;
      end loop;
      area_ids := array_append(area_ids,area->>'id');
      if jsonb_array_length(area->'mulch')>8 then return false; end if;
      if jsonb_array_length(area->'mulch')>0 then
        cover := (area - 'mulch') || jsonb_build_object('name',coalesce(nullif(btrim(area->>'name'),''),'Area'),'layers',area->'mulch');
        covers := covers || jsonb_build_array(cover);
        for layer in select jsonb_array_elements(area->'mulch') loop
          if layer->>'id'=any(layer_ids) then return false; end if;
          layer_ids := array_append(layer_ids,layer->>'id');
          foreach field in array array['categoryId','plantTypeId','cultivarId'] loop
            if layer->'material' ? field and jsonb_typeof(layer->'material'->field) is distinct from 'null' then
              if jsonb_typeof(layer->'material'->field) is distinct from 'string' or length(btrim(layer->'material'->>field)) not between 1 and 128 then return false; end if;
            end if;
          end loop;
          if jsonb_typeof(layer->'material'->'cultivarId')='string' and jsonb_typeof(layer->'material'->'plantTypeId') is distinct from 'string' then return false; end if;
        end loop;
      end if;
      if area->>'kind'='rows' then
        if not public.myco_valid_plant_snapshot(area->'plant') then return false; end if;
        rows := rows || jsonb_build_array(area);
      elsif area->>'kind'='broadcast' then
        if jsonb_typeof(area->'density') is distinct from 'number' or (area->>'density')::numeric<=0 or (area->>'density')::numeric>1000000
          or coalesce(area->>'densityUnit','') not in ('g_m2','seeds_m2') then return false; end if;
        if area->'sowing'->>'kind'='crop' then
          if not public.myco_valid_plant_snapshot(area->'sowing'->'plant') then return false; end if;
        elsif area->'sowing'->>'kind'='mixture' then
          mixture := area->'sowing'->'mixture';
          if area->>'densityUnit'<>'g_m2' or jsonb_typeof(mixture) is distinct from 'object'
            or jsonb_typeof(mixture->'id') is distinct from 'string' or length(btrim(mixture->>'id')) not between 1 and 128
            or jsonb_typeof(mixture->'name') is distinct from 'string' or length(btrim(mixture->>'name')) not between 1 and 100
            or jsonb_typeof(mixture->'notes') is distinct from 'string' or length(mixture->>'notes')>2000
            or jsonb_typeof(mixture->'version') is distinct from 'number' or jsonb_typeof(mixture->'components') is distinct from 'array' then return false; end if;
          value := (mixture->>'version')::numeric;
          if value<1 or value<>trunc(value) or value>9007199254740991 or jsonb_array_length(mixture->'components') not between 1 and 50 then return false; end if;
          total := 0; component_keys := array[]::text[];
          for component in select jsonb_array_elements(mixture->'components') loop
            if not public.myco_valid_plant_snapshot(component->'plant') or jsonb_typeof(component->'percentage') is distinct from 'number' then return false; end if;
            value := (component->>'percentage')::numeric;
            if value<=0 or value>100 then return false; end if;
            component_key := (component->'plant'->>'id')||':'||coalesce(component->'plant'->>'cultivarId','');
            if component_key=any(component_keys) then return false; end if;
            component_keys := array_append(component_keys,component_key); total := total+value;
          end loop;
          if abs(total-100)>0.000001 then return false; end if;
        else return false; end if;
      end if;
    end loop;
    if jsonb_array_length(rows)>0 and not public.myco_valid_legacy_planting_plans(jsonb_build_array(jsonb_build_object('widthCm',w,'lengthCm',l,'plantingPlan',jsonb_build_object('version',5,'respectAreaSpacing',plan->'respectAreaSpacing','areas',rows,'advice','[]'::jsonb)))) then return false; end if;
    if jsonb_array_length(covers)>0 and not public.myco_valid_mulch_plans(jsonb_build_array(jsonb_build_object('widthCm',w,'lengthCm',l,'mulchPlan',jsonb_build_object('version',1,'areas',covers)))) then return false; end if;
  end loop;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end; $$;

create function public.myco_valid_planting_plans(beds jsonb) returns boolean
language sql immutable set search_path='' as $$
  select public.myco_valid_legacy_planting_plans(beds) and public.myco_valid_area_plans(beds);
$$;
revoke all on function public.myco_valid_plant_snapshot(jsonb), public.myco_valid_area_plans(jsonb), public.myco_valid_planting_plans(jsonb) from public, anon;
grant execute on function public.myco_valid_plant_snapshot(jsonb), public.myco_valid_area_plans(jsonb), public.myco_valid_planting_plans(jsonb) to authenticated;
alter table public.gardens add constraint gardens_valid_areas check(public.myco_valid_area_plans(beds));

-- Existing format-5 rows without independent mulch retain their geometry and
-- snapshots. Other legacy layouts remain readable through the history renderer.
update public.gardens g
set beds=(select jsonb_agg(case
  when b->'plantingPlan'->'version'='5'::jsonb and not (b ? 'mulchPlan') and not (b ? 'areaPlan') then
    (b-'plantingPlan') || jsonb_build_object('areaPlan',jsonb_build_object('version',1,'respectAreaSpacing',b->'plantingPlan'->'respectAreaSpacing',
      'areas',(select coalesce(jsonb_agg(a || jsonb_build_object('kind','rows','purpose','crop','name','','mulch','[]'::jsonb)),'[]'::jsonb) from jsonb_array_elements(b->'plantingPlan'->'areas') a)))
  else b end order by ord) from jsonb_array_elements(g.beds) with ordinality items(b,ord))
where exists(select 1 from jsonb_array_elements(g.beds) b where b->'plantingPlan'->'version'='5'::jsonb and not (b ? 'mulchPlan') and not (b ? 'areaPlan'));

notify pgrst, 'reload schema';
commit;
