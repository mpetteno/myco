begin;

-- Optional per-edge minima extend format 5 without rewriting current gardens,
-- catalogue references or recorded snapshots. Older algorithms stay unchanged.
-- The row capacity formula matches balancedAreaLayout.ts in both directions.
create or replace function public.myco_valid_legacy_planting_plans(beds jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  bed jsonb; plan jsonb; area jsonb; plant jsonb; advice jsonb;
  field text; value numeric;
  w numeric; l numeric; x numeric; y numeric; aw numeric; al numeric;
  plant_step numeric; row_step numeric; columns_count numeric; rows_count numeric;
  candidates numeric; edge_cm numeric; area_direction text; chosen_rows numeric;
  across_start numeric; across_end numeric; max_rows numeric;
  margin_along numeric; margin_across numeric; along_size numeric; across_size numeric;
  clearances jsonb; clearance jsonb; side text; min_border numeric;
  left_cm numeric; right_cm numeric; top_cm numeric; bottom_cm numeric;
begin
  if jsonb_typeof(beds) is distinct from 'array' then return false; end if;
  for bed in select jsonb_array_elements(beds) loop
    if not (bed ? 'plantingPlan') then continue; end if;
    plan := bed->'plantingPlan';
    if jsonb_typeof(plan) is distinct from 'object'
      or coalesce(plan->'version', 'null'::jsonb) not in ('1'::jsonb, '2'::jsonb, '3'::jsonb, '4'::jsonb, '5'::jsonb)
      or (plan->'version' = '1'::jsonb and coalesce(plan->>'rowDirection', '') not in ('width', 'length'))
      or jsonb_typeof(plan->'respectAreaSpacing') is distinct from 'boolean'
      or jsonb_typeof(plan->'areas') is distinct from 'array'
      or jsonb_typeof(plan->'advice') is distinct from 'array'
      or jsonb_typeof(bed->'widthCm') is distinct from 'number'
      or jsonb_typeof(bed->'lengthCm') is distinct from 'number' then return false; end if;
    if jsonb_array_length(plan->'areas') not between 1 and 12
      or jsonb_array_length(plan->'advice') > 66 then return false; end if;
    w := (bed->>'widthCm')::numeric; l := (bed->>'lengthCm')::numeric;
    edge_cm := case when plan->'version' = '1'::jsonb then 5 else 15 end;
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
      chosen_rows := null;
      area_direction := plan->>'rowDirection';
      if plan->'version' in ('2'::jsonb, '3'::jsonb, '4'::jsonb, '5'::jsonb) then
        area_direction := area->>'rowDirection';
        if coalesce(area_direction, '') not in ('width', 'length') then return false; end if;
        if jsonb_typeof(area->'rowCount') = 'number' then
          chosen_rows := (area->>'rowCount')::numeric;
          if chosen_rows <> trunc(chosen_rows) or chosen_rows < 1 or chosen_rows > 20000 then return false; end if;
        elsif jsonb_typeof(area->'rowCount') is distinct from 'null' then return false;
        end if;
      end if;
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
      if plant ? 'borderDistanceCm' then
        if jsonb_typeof(plant->'borderDistanceCm') is distinct from 'number' then return false; end if;
        value := (plant->>'borderDistanceCm')::numeric;
        if value < 5 or value > 9007199254740991 or mod(value, 5) <> 0 then return false; end if;
      end if;
      if area ? 'clearancesCm' then
        clearances := area->'clearancesCm';
        if plan->'version' is distinct from '5'::jsonb or jsonb_typeof(clearances) is distinct from 'object' then return false; end if;
        min_border := coalesce((plant->>'borderDistanceCm')::numeric, 15);
        for side, clearance in select * from jsonb_each(clearances) loop
          if side not in ('top','right','bottom','left') or jsonb_typeof(clearance) is distinct from 'number' then return false; end if;
          value := clearance::numeric;
          if value < min_border or value > 9007199254740991 or mod(value,5) <> 0 then return false; end if;
        end loop;
      end if;
      plant_step := ceil((area->>'plantSpacingCm')::numeric / 5) * 5;
      row_step := ceil((area->>'rowSpacingCm')::numeric / 5) * 5;
      if plan->'version' in ('3'::jsonb, '4'::jsonb, '5'::jsonb) then
        margin_along := greatest(5, ceil(coalesce((plant->>'plantSpacingCm')::numeric, (area->>'plantSpacingCm')::numeric) / 10) * 5);
        margin_across := greatest(5, ceil(coalesce((plant->>'rowSpacingCm')::numeric, (area->>'rowSpacingCm')::numeric) / 10) * 5);
        if plan->'version' = '4'::jsonb then
          margin_along := 20; margin_across := 20;
        elsif plan->'version' = '5'::jsonb then
          margin_along := coalesce((plant->>'borderDistanceCm')::numeric, 15);
          margin_across := margin_along;
        end if;
        along_size := case when area_direction = 'width' then aw else al end;
        across_size := case when area_direction = 'width' then al else aw end;
        if plan->'version' = '5'::jsonb and area ? 'clearancesCm' then
          left_cm := coalesce((area->'clearancesCm'->>'left')::numeric, margin_along);
          right_cm := coalesce((area->'clearancesCm'->>'right')::numeric, margin_along);
          top_cm := coalesce((area->'clearancesCm'->>'top')::numeric, margin_along);
          bottom_cm := coalesce((area->'clearancesCm'->>'bottom')::numeric, margin_along);
          if area_direction = 'width' then
            columns_count := greatest(0, floor((along_size-left_cm-right_cm)/plant_step)+1);
            across_start := top_cm; across_end := across_size-bottom_cm;
          else
            columns_count := greatest(0, floor((along_size-top_cm-bottom_cm)/plant_step)+1);
            across_start := left_cm; across_end := across_size-right_cm;
          end if;
        else
          columns_count := greatest(0, floor((along_size - 2 * margin_along) / plant_step) + 1);
          across_start := margin_across; across_end := across_size - margin_across;
        end if;
      elsif area_direction = 'width' then
        columns_count := greatest(0, floor((least(w - edge_cm, x + aw - 5) - greatest(edge_cm, x)) / plant_step) + 1);
        across_start := greatest(edge_cm, y); across_end := least(l - edge_cm, y + al - 5);
      else
        columns_count := greatest(0, floor((least(l - edge_cm, y + al - 5) - greatest(edge_cm, y)) / plant_step) + 1);
        across_start := greatest(edge_cm, x); across_end := least(w - edge_cm, x + aw - 5);
      end if;
      if chosen_rows is not null then
        max_rows := greatest(0, floor((across_end - across_start) / 5) + 1);
        if chosen_rows > max_rows or columns_count = 0 then return false; end if;
        rows_count := chosen_rows;
      else
        rows_count := greatest(0, floor((across_end - across_start) / row_step) + 1);
      end if;
      if area ? 'clearancesCm' and (columns_count = 0 or rows_count = 0) then return false; end if;
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


create or replace function public.myco_valid_area_plans(beds jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare bed jsonb; normalized jsonb; area jsonb;
begin
  if jsonb_typeof(beds) is distinct from 'array' then return false; end if;
  for bed in select jsonb_array_elements(beds) loop
    if bed ? 'areaPlan' and jsonb_typeof(bed->'areaPlan'->'areas') = 'array' then
      for area in select jsonb_array_elements(bed->'areaPlan'->'areas') loop
        if area ? 'clearancesCm' and (bed->'areaPlan'->'version' is distinct from '5'::jsonb or area->>'kind' is distinct from 'rows') then return false; end if;
      end loop;
    end if;
    if bed->'areaPlan'->'version' = '5'::jsonb then
      if bed->'areaPlan'->'respectAreaSpacing' is distinct from 'false'::jsonb then return false; end if;
      normalized := jsonb_set(bed, '{areaPlan,version}', '4'::jsonb);
      if not public.myco_valid_area_plans_v4(jsonb_build_array(normalized)) then return false; end if;
    elsif not public.myco_valid_area_plans_v4(jsonb_build_array(bed)) then return false;
    end if;
  end loop;
  return true;
end; $$;

revoke all on function public.myco_valid_legacy_planting_plans(jsonb), public.myco_valid_area_plans(jsonb) from public, anon;
grant execute on function public.myco_valid_legacy_planting_plans(jsonb), public.myco_valid_area_plans(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
