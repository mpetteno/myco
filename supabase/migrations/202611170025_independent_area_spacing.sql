begin;

-- New area plans use only their own row and border spacing. Keep the prior
-- generators available so recorded history retains its original plant counts.
alter function public.myco_valid_area_plans(jsonb) rename to myco_valid_area_plans_v4;
create function public.myco_valid_area_plans(beds jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare bed jsonb; normalized jsonb;
begin
  if jsonb_typeof(beds) is distinct from 'array' then return false; end if;
  for bed in select jsonb_array_elements(beds) loop
    if bed->'areaPlan'->'version' = '5'::jsonb then
      if bed->'areaPlan'->'respectAreaSpacing' is distinct from 'false'::jsonb then return false; end if;
      normalized := jsonb_set(bed, '{areaPlan,version}', '4'::jsonb);
      if not public.myco_valid_area_plans_v4(jsonb_build_array(normalized)) then return false; end if;
    elsif not public.myco_valid_area_plans_v4(jsonb_build_array(bed)) then return false;
    end if;
  end loop;
  return true;
end; $$;
revoke all on function public.myco_valid_area_plans(jsonb) from public, anon;
grant execute on function public.myco_valid_area_plans(jsonb) to authenticated;
alter table public.gardens drop constraint gardens_valid_areas;
alter table public.gardens add constraint gardens_valid_areas check(public.myco_valid_area_plans(beds));

-- Apply the change to current plans only. Bed/area bounds, planting references,
-- selected rows, within-area spacing, mulch and recorded snapshots stay intact.
update public.gardens g
set beds=(
  select jsonb_agg(case
    when b ? 'areaPlan' then jsonb_set(b, '{areaPlan,respectAreaSpacing}', 'false'::jsonb)
    when b ? 'plantingPlan' then jsonb_set(b, '{plantingPlan,respectAreaSpacing}', 'false'::jsonb)
    else b end order by ord)
  from jsonb_array_elements(g.beds) with ordinality items(b,ord)
)
where exists (
  select 1 from jsonb_array_elements(g.beds) b
  where b->'areaPlan'->'respectAreaSpacing'='true'::jsonb
     or b->'plantingPlan'->'respectAreaSpacing'='true'::jsonb
);

notify pgrst, 'reload schema';
commit;
