begin;

-- Material snapshots and layer order belong to the atomic garden document.
create function public.myco_valid_mulch_plans(beds jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  bed jsonb; plan jsonb; area jsonb; layer jsonb; material jsonb;
  field text; value numeric; w numeric; l numeric;
begin
  if jsonb_typeof(beds) is distinct from 'array' then return false; end if;
  for bed in select jsonb_array_elements(beds) loop
    if not (bed ? 'mulchPlan') then continue; end if;
    plan := bed->'mulchPlan';
    if jsonb_typeof(plan) is distinct from 'object'
      or plan->'version' is distinct from '1'::jsonb
      or jsonb_typeof(plan->'areas') is distinct from 'array'
      or jsonb_typeof(bed->'widthCm') is distinct from 'number'
      or jsonb_typeof(bed->'lengthCm') is distinct from 'number' then return false; end if;
    if jsonb_array_length(plan->'areas') not between 1 and 12 then return false; end if;
    w := (bed->>'widthCm')::numeric; l := (bed->>'lengthCm')::numeric;
    for area in select jsonb_array_elements(plan->'areas') loop
      if jsonb_typeof(area) is distinct from 'object'
        or jsonb_typeof(area->'id') is distinct from 'string'
        or length(area->>'id') > 128 or length(btrim(area->>'id')) = 0
        or jsonb_typeof(area->'name') is distinct from 'string'
        or length(btrim(area->>'name')) not between 1 and 100
        or jsonb_typeof(area->'layers') is distinct from 'array' then return false; end if;
      foreach field in array array['xCm','yCm','widthCm','lengthCm'] loop
        if jsonb_typeof(area->field) is distinct from 'number' then return false; end if;
        value := (area->>field)::numeric;
        if value <> trunc(value) or mod(value, 5) <> 0 or value < 0 or value > 9007199254740991 then return false; end if;
      end loop;
      if (area->>'widthCm')::numeric < 5 or (area->>'lengthCm')::numeric < 5
        or (area->>'xCm')::numeric + (area->>'widthCm')::numeric > w
        or (area->>'yCm')::numeric + (area->>'lengthCm')::numeric > l then return false; end if;
      if jsonb_array_length(area->'layers') not between 1 and 8 then return false; end if;
      for layer in select jsonb_array_elements(area->'layers') loop
        if jsonb_typeof(layer) is distinct from 'object'
          or jsonb_typeof(layer->'id') is distinct from 'string'
          or length(layer->>'id') > 128 or length(btrim(layer->>'id')) = 0 then return false; end if;
        material := layer->'material';
        if jsonb_typeof(material) is distinct from 'object'
          or jsonb_typeof(material->'id') is distinct from 'string'
          or length(material->>'id') > 128 or length(btrim(material->>'id')) = 0
          or jsonb_typeof(material->'name') is distinct from 'string'
          or length(btrim(material->>'name')) not between 1 and 100
          or jsonb_typeof(material->'notes') is distinct from 'string'
          or length(material->>'notes') > 2000
          or jsonb_typeof(material->'version') is distinct from 'number' then return false; end if;
        value := (material->>'version')::numeric;
        if value <> trunc(value) or value < 1 or value > 9007199254740991 then return false; end if;
      end loop;
    end loop;
    if (select count(*) <> count(distinct item->>'id') from jsonb_array_elements(plan->'areas') item) then return false; end if;
    if (select count(*) <> count(distinct layers.item->>'id')
      from jsonb_array_elements(plan->'areas') as areas(item)
      cross join lateral jsonb_array_elements(areas.item->'layers') as layers(item)) then return false; end if;
    if exists (
      select 1 from jsonb_array_elements(plan->'areas') with ordinality a(item,n)
      join jsonb_array_elements(plan->'areas') with ordinality b(item,n) on a.n < b.n
      where (a.item->>'xCm')::numeric < (b.item->>'xCm')::numeric + (b.item->>'widthCm')::numeric
        and (a.item->>'xCm')::numeric + (a.item->>'widthCm')::numeric > (b.item->>'xCm')::numeric
        and (a.item->>'yCm')::numeric < (b.item->>'yCm')::numeric + (b.item->>'lengthCm')::numeric
        and (a.item->>'yCm')::numeric + (a.item->>'lengthCm')::numeric > (b.item->>'yCm')::numeric
    ) then return false; end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.myco_valid_mulch_plans(jsonb) from public, anon, authenticated;
grant execute on function public.myco_valid_mulch_plans(jsonb) to authenticated;
alter table public.gardens add constraint gardens_valid_mulch check (public.myco_valid_mulch_plans(beds));

notify pgrst, 'reload schema';
commit;
