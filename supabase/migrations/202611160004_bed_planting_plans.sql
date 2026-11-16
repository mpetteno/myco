begin;

-- Plans are part of the existing atomic garden snapshot and use its access rules.
create function public.myco_valid_planting_plans(beds jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  bed jsonb; plan jsonb; area jsonb; plant jsonb; advice jsonb;
  field text; value numeric;
  w numeric; l numeric; x numeric; y numeric; aw numeric; al numeric;
  plant_step numeric; row_step numeric; columns_count numeric; rows_count numeric;
  candidates numeric;
begin
  if jsonb_typeof(beds) is distinct from 'array' then return false; end if;
  for bed in select jsonb_array_elements(beds) loop
    if not (bed ? 'plantingPlan') then continue; end if;
    plan := bed->'plantingPlan';
    if jsonb_typeof(plan) is distinct from 'object'
      or plan->'version' is distinct from '1'::jsonb
      or coalesce(plan->>'rowDirection', '') not in ('width', 'length')
      or jsonb_typeof(plan->'respectAreaSpacing') is distinct from 'boolean'
      or jsonb_typeof(plan->'areas') is distinct from 'array'
      or jsonb_typeof(plan->'advice') is distinct from 'array'
      or jsonb_typeof(bed->'widthCm') is distinct from 'number'
      or jsonb_typeof(bed->'lengthCm') is distinct from 'number' then return false; end if;
    if jsonb_array_length(plan->'areas') not between 1 and 12
      or jsonb_array_length(plan->'advice') > 66 then return false; end if;
    w := (bed->>'widthCm')::numeric; l := (bed->>'lengthCm')::numeric;
    candidates := 0;
    for area in select jsonb_array_elements(plan->'areas') loop
      if jsonb_typeof(area) is distinct from 'object'
        or jsonb_typeof(area->'id') is distinct from 'string'
        or length(btrim(area->>'id')) not between 1 and 128 then return false; end if;
      foreach field in array array['xCm','yCm','widthCm','lengthCm'] loop
        if jsonb_typeof(area->field) is distinct from 'number' then return false; end if;
        value := (area->>field)::numeric;
        if value <> trunc(value) or mod(value, 5) <> 0 or value < 0 or value > 9007199254740991 then return false; end if;
      end loop;
      x := (area->>'xCm')::numeric; y := (area->>'yCm')::numeric;
      aw := (area->>'widthCm')::numeric; al := (area->>'lengthCm')::numeric;
      if aw < 5 or al < 5 or x + aw > w or y + al > l then return false; end if;
      foreach field in array array['plantSpacingCm','rowSpacingCm'] loop
        if jsonb_typeof(area->field) is distinct from 'number' then return false; end if;
        value := (area->>field)::numeric;
        if value <= 0 or value > 9007199254740986 then return false; end if;
      end loop;
      plant := area->'plant';
      if jsonb_typeof(plant) is distinct from 'object' then return false; end if;
      foreach field in array array['id','name','familyId','familyName'] loop
        if jsonb_typeof(plant->field) is distinct from 'string'
          or length(btrim(plant->>field)) not between 1 and 128 then return false; end if;
      end loop;
      foreach field in array array['typeVersion','familyVersion'] loop
        if jsonb_typeof(plant->field) is distinct from 'number' then return false; end if;
        value := (plant->>field)::numeric;
        if value <> trunc(value) or value < 1 or value > 9007199254740991 then return false; end if;
      end loop;
      foreach field in array array['plantSpacingCm','rowSpacingCm'] loop
        if jsonb_typeof(plant->field) = 'null' then continue; end if;
        if jsonb_typeof(plant->field) is distinct from 'number' then return false; end if;
        value := (plant->>field)::numeric;
        if value <= 0 or value > 9007199254740991 then return false; end if;
      end loop;
      plant_step := ceil((area->>'plantSpacingCm')::numeric / 5) * 5;
      row_step := ceil((area->>'rowSpacingCm')::numeric / 5) * 5;
      if plan->>'rowDirection' = 'width' then
        columns_count := greatest(0, floor((least(w - 5, x + aw - 5) - greatest(5, x)) / plant_step) + 1);
        rows_count := greatest(0, floor((least(l - 5, y + al - 5) - greatest(5, y)) / row_step) + 1);
      else
        columns_count := greatest(0, floor((least(l - 5, y + al - 5) - greatest(5, y)) / plant_step) + 1);
        rows_count := greatest(0, floor((least(w - 5, x + aw - 5) - greatest(5, x)) / row_step) + 1);
      end if;
      candidates := candidates + columns_count * rows_count;
      if candidates > 20000 then return false; end if;
    end loop;
    if candidates = 0 then return false; end if;
    if (select count(*) <> count(distinct item->>'id') from jsonb_array_elements(plan->'areas') item) then return false; end if;
    if exists (
      select 1 from jsonb_array_elements(plan->'areas') with ordinality a(item,n)
      join jsonb_array_elements(plan->'areas') with ordinality b(item,n) on a.n < b.n
      where (a.item->>'xCm')::numeric < (b.item->>'xCm')::numeric + (b.item->>'widthCm')::numeric
        and (a.item->>'xCm')::numeric + (a.item->>'widthCm')::numeric > (b.item->>'xCm')::numeric
        and (a.item->>'yCm')::numeric < (b.item->>'yCm')::numeric + (b.item->>'lengthCm')::numeric
        and (a.item->>'yCm')::numeric + (a.item->>'lengthCm')::numeric > (b.item->>'yCm')::numeric
    ) then return false; end if;
    for advice in select jsonb_array_elements(plan->'advice') loop
      if jsonb_typeof(advice) is distinct from 'object'
        or coalesce(advice->>'relationship','') not in ('companion','caution','unknown')
        or jsonb_typeof(advice->'notes') is distinct from 'string'
        or length(advice->>'notes') > 4000
        or not exists (select 1 from jsonb_array_elements(plan->'areas') item where item->'id' = advice->'firstAreaId')
        or not exists (select 1 from jsonb_array_elements(plan->'areas') item where item->'id' = advice->'secondAreaId') then return false; end if;
    end loop;
  end loop;
  return true;
end;
$$;

revoke all on function public.myco_valid_planting_plans(jsonb) from public, anon, authenticated;
grant execute on function public.myco_valid_planting_plans(jsonb) to authenticated;
alter table public.gardens add constraint gardens_valid_planting_plans
check (public.myco_valid_planting_plans(beds));

notify pgrst, 'reload schema';
commit;
