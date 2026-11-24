begin;

-- Repeat-safe starter materials; preserve any existing administrator-edited names and notes.
insert into public.mulch_types(name, category_id)
select seed.name, category.id
from (values
  ('leaves', 'organic'), ('fieno', 'organic'), ('paglia', 'organic'),
  ('sfalci d''erba', 'organic'), ('cartone', 'organic'), ('corteccia', 'organic'),
  ('compost', 'organic'), ('telo sintetico', 'synthetic')
) as seed(name, code)
join public.mulch_categories category on category.code = seed.code
where not exists (select 1 from public.mulch_types m where lower(btrim(m.name)) = lower(seed.name))
on conflict do nothing;

-- Preserve the original records before removing exact numeric duplicates only.
create table if not exists public.plant_depth_notes_backup_202611240030 (
  id uuid primary key, row_data jsonb not null, backed_up_at timestamptz not null default now()
);
revoke all on public.plant_depth_notes_backup_202611240030 from public, anon, authenticated;
insert into public.plant_depth_notes_backup_202611240030(id, row_data)
select d.id, to_jsonb(d)
from public.plant_depths d
where case when btrim(d.notes) ~ '^[0-9]+([.][0-9]+)?$' then btrim(d.notes)::numeric = d.depth_cm else false end
on conflict (id) do nothing;
update public.plant_depths d set notes = ''
where case when btrim(d.notes) ~ '^[0-9]+([.][0-9]+)?$' then btrim(d.notes)::numeric = d.depth_cm else false end;

-- Flag-derived materials use stable living:crop:<id> / living:cultivar:<id> IDs.
-- Apply eligibility checks to new layers in both unified and legacy garden plans.
create or replace function public.myco_check_new_living_layers() returns trigger
language plpgsql set search_path = '' as $$
declare bed jsonb; layer jsonb; material jsonb; previous_beds jsonb; eligible boolean;
begin
  previous_beds := case when tg_op = 'INSERT' then '[]'::jsonb else old.beds end;
  for bed in select jsonb_array_elements(new.beds) loop
    for layer in
      select l from jsonb_array_elements(coalesce(bed->'areaPlan'->'areas', '[]'::jsonb)) a
        cross join lateral jsonb_array_elements(coalesce(a->'mulch', '[]'::jsonb)) l
      union all
      select l from jsonb_array_elements(coalesce(bed->'mulchPlan'->'areas', '[]'::jsonb)) a
        cross join lateral jsonb_array_elements(coalesce(a->'layers', '[]'::jsonb)) l
    loop
      if exists (
        select 1 from jsonb_array_elements(previous_beds) b
        cross join lateral (
          select l from jsonb_array_elements(coalesce(b->'areaPlan'->'areas', '[]'::jsonb)) a
            cross join lateral jsonb_array_elements(coalesce(a->'mulch', '[]'::jsonb)) l
          union all
          select l from jsonb_array_elements(coalesce(b->'mulchPlan'->'areas', '[]'::jsonb)) a
            cross join lateral jsonb_array_elements(coalesce(a->'layers', '[]'::jsonb)) l
        ) prior_layer
        where b->>'id' = bed->>'id' and prior_layer.l->>'id' = layer->>'id'
          and prior_layer.l->'material' = layer->'material'
      ) then continue; end if;
      material := layer->'material'; eligible := null;
      if material->>'id' like 'living:%' then
        if material->>'id' = 'living:crop:' || (material->>'plantTypeId') and material->>'cultivarId' is null then
          select p.living_mulch_enabled into eligible from public.plant_types p where p.id::text = material->>'plantTypeId';
        elsif material->>'id' = 'living:cultivar:' || (material->>'cultivarId') then
          select coalesce(c.living_mulch_enabled, p.living_mulch_enabled) into eligible
          from public.plant_cultivars c join public.plant_types p on p.id = c.plant_type_id
          where c.id::text = material->>'cultivarId' and p.id::text = material->>'plantTypeId';
        end if;
        if eligible is distinct from true then raise exception 'This plant is no longer eligible for new living mulch layers' using errcode = '23514'; end if;
      else
        select coalesce(c.living_mulch_enabled, p.living_mulch_enabled, false) into eligible
        from public.mulch_types m join public.mulch_categories category on category.id = m.category_id and category.code = 'living'
        join public.plant_types p on p.id = m.plant_type_id left join public.plant_cultivars c on c.id = m.cultivar_id
        where m.id::text = material->>'id';
        if eligible is false then raise exception 'This plant is no longer eligible for new living mulch layers' using errcode = '23514'; end if;
      end if;
    end loop;
  end loop;
  return new;
end; $$;
revoke all on function public.myco_check_new_living_layers() from public;
commit;
