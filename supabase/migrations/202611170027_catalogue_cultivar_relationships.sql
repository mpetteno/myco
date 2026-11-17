begin;

-- Preserve existing identities and administrator RLS while adding cultivar endpoints.
alter table public.companion_rules
  add column cultivar_a_id uuid references public.plant_cultivars(id) on delete cascade,
  add column cultivar_b_id uuid references public.plant_cultivars(id) on delete cascade,
  drop constraint companion_rules_check,
  drop constraint companion_rules_check1,
  drop constraint companion_rules_check2,
  drop constraint companion_rules_first_key_second_key_key,
  drop column first_key,
  drop column second_key;
alter table public.companion_rules
  add column first_key text generated always as (coalesce('family:' || family_a_id::text, 'plant:' || plant_a_id::text, 'cultivar:' || cultivar_a_id::text)) stored,
  add column second_key text generated always as (coalesce('family:' || family_b_id::text, 'plant:' || plant_b_id::text, 'cultivar:' || cultivar_b_id::text)) stored,
  add check (num_nonnulls(family_a_id, plant_a_id, cultivar_a_id) = 1),
  add check (num_nonnulls(family_b_id, plant_b_id, cultivar_b_id) = 1),
  add check (first_key <= second_key),
  add unique(first_key, second_key);
grant insert(cultivar_a_id,cultivar_b_id), update(cultivar_a_id,cultivar_b_id) on public.companion_rules to authenticated;

alter table public.rotation_rules
  add column current_cultivar_id uuid references public.plant_cultivars(id) on delete cascade,
  add column previous_cultivar_id uuid references public.plant_cultivars(id) on delete cascade,
  drop constraint rotation_rules_check,
  drop constraint rotation_rules_check1;
do $$ declare entry record; begin
  for entry in select conname from pg_constraint where conrelid='public.rotation_rules'::regclass and contype='u' loop
    execute format('alter table public.rotation_rules drop constraint %I',entry.conname);
  end loop;
end $$;
alter table public.rotation_rules
  add check (num_nonnulls(current_family_id,current_plant_id,current_cultivar_id)=1),
  add check (num_nonnulls(previous_family_id,previous_plant_id,previous_cultivar_id)=1),
  add unique nulls not distinct(current_family_id,current_plant_id,current_cultivar_id,previous_family_id,previous_plant_id,previous_cultivar_id);
grant insert(current_cultivar_id,previous_cultivar_id), update(current_cultivar_id,previous_cultivar_id) on public.rotation_rules to authenticated;

-- Relationship changes invalidate the owning crop/cultivar revisions too.
create function public.myco_touch_relationship_owners() returns trigger language plpgsql security definer set search_path='' as $$
declare payload jsonb; previous jsonb;
begin
  payload := case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  previous := case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  update public.plant_types set notes=notes where id in (
    select value::uuid from jsonb_each_text(payload) where key in ('plant_a_id','plant_b_id','current_plant_id','previous_plant_id') and value is not null
    union select value::uuid from jsonb_each_text(previous) where key in ('plant_a_id','plant_b_id','current_plant_id','previous_plant_id') and value is not null
  );
  update public.plant_cultivars set notes=notes where id in (
    select value::uuid from jsonb_each_text(payload) where key in ('cultivar_a_id','cultivar_b_id','current_cultivar_id','previous_cultivar_id') and value is not null
    union select value::uuid from jsonb_each_text(previous) where key in ('cultivar_a_id','cultivar_b_id','current_cultivar_id','previous_cultivar_id') and value is not null
  );
  return null;
end $$;
revoke all on function public.myco_touch_relationship_owners() from public;
create trigger companion_rules_touch_owners after insert or update or delete on public.companion_rules for each row execute function public.myco_touch_relationship_owners();
create trigger rotation_rules_touch_owners after insert or update or delete on public.rotation_rules for each row execute function public.myco_touch_relationship_owners();

notify pgrst,'reload schema';
commit;
