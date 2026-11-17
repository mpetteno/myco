begin;

-- Format 1 remains readable for existing layouts/history. Format 2 removes
-- unplanted areas from new plans and restricts rows to harvest crops.
alter function public.myco_valid_area_plans(jsonb) rename to myco_valid_area_plans_v1;
create function public.myco_valid_area_plans(beds jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare bed jsonb; area jsonb; normalized jsonb;
begin
  if jsonb_typeof(beds) is distinct from 'array' then return false; end if;
  for bed in select jsonb_array_elements(beds) loop
    if bed->'areaPlan'->'version' = '2'::jsonb then
      normalized := jsonb_set(bed, '{areaPlan,version}', '1'::jsonb);
      if not public.myco_valid_area_plans_v1(jsonb_build_array(normalized)) then return false; end if;
      for area in select jsonb_array_elements(bed->'areaPlan'->'areas') loop
        if area->>'kind' not in ('rows','broadcast') then return false; end if;
        if area->>'kind'='rows' and area->>'purpose'<>'crop' then return false; end if;
      end loop;
    elsif not public.myco_valid_area_plans_v1(jsonb_build_array(bed)) then return false;
    end if;
  end loop;
  return true;
end; $$;
revoke all on function public.myco_valid_area_plans(jsonb) from public, anon;
grant execute on function public.myco_valid_area_plans(jsonb) to authenticated;
-- The existing constraint refers to the old function by OID; rebind it.
alter table public.gardens drop constraint gardens_valid_areas;
alter table public.gardens add constraint gardens_valid_areas check(public.myco_valid_area_plans(beds));

notify pgrst, 'reload schema';
commit;
