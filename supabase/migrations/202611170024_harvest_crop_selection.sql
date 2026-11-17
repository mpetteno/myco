begin;

-- Format 4 separates sowing selection by purpose and uses gram densities only.
-- Older documents remain readable without rewriting saved layouts or history.
alter function public.myco_valid_area_plans(jsonb) rename to myco_valid_area_plans_v3;
create function public.myco_valid_area_plans(beds jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare bed jsonb; area jsonb; normalized jsonb;
begin
  if jsonb_typeof(beds) is distinct from 'array' then return false; end if;
  for bed in select jsonb_array_elements(beds) loop
    if bed->'areaPlan'->'version' = '4'::jsonb then
      normalized := jsonb_set(bed, '{areaPlan,version}', '3'::jsonb);
      if not public.myco_valid_area_plans_v3(jsonb_build_array(normalized)) then return false; end if;
      for area in select jsonb_array_elements(bed->'areaPlan'->'areas') loop
        if area->>'kind'='broadcast' then
          if area->>'purpose'='crop' and area->'sowing'->>'kind' is distinct from 'crop' then return false; end if;
          if area->>'densityUnit' is distinct from 'g_m2' then return false; end if;
        end if;
      end loop;
    elsif not public.myco_valid_area_plans_v3(jsonb_build_array(bed)) then return false;
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
