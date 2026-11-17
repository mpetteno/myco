begin;

-- Prior snapshots remain readable. New green-manure areas always capture a
-- seed mixture; a single crop/cultivar is not a green-manure selection.
alter function public.myco_valid_area_plans(jsonb) rename to myco_valid_area_plans_v2;
create function public.myco_valid_area_plans(beds jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare bed jsonb; area jsonb; normalized jsonb;
begin
  if jsonb_typeof(beds) is distinct from 'array' then return false; end if;
  for bed in select jsonb_array_elements(beds) loop
    if bed->'areaPlan'->'version' = '3'::jsonb then
      normalized := jsonb_set(bed, '{areaPlan,version}', '2'::jsonb);
      if not public.myco_valid_area_plans_v2(jsonb_build_array(normalized)) then return false; end if;
      for area in select jsonb_array_elements(bed->'areaPlan'->'areas') loop
        if area->>'purpose'='green_manure' and (
          area->>'kind'<>'broadcast' or area->'sowing'->>'kind' is distinct from 'mixture'
        ) then return false; end if;
      end loop;
    elsif not public.myco_valid_area_plans_v2(jsonb_build_array(bed)) then return false;
    end if;
  end loop;
  return true;
end; $$;
revoke all on function public.myco_valid_area_plans(jsonb) from public, anon;
grant execute on function public.myco_valid_area_plans(jsonb) to authenticated;
alter table public.gardens drop constraint gardens_valid_areas;
alter table public.gardens add constraint gardens_valid_areas check(public.myco_valid_area_plans(beds));

notify pgrst, 'reload schema';
commit;
