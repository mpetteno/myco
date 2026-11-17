begin;

alter table public.plant_types
  add column scientific_name text not null default '' check (length(scientific_name) <= 200),
  add column living_mulch_enabled boolean not null default false;
grant insert (scientific_name, living_mulch_enabled), update (scientific_name, living_mulch_enabled) on public.plant_types to authenticated;

create table public.plant_cultivars (id uuid primary key default gen_random_uuid(), version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), name text not null check (length(btrim(name)) between 1 and 100), notes text not null default '' check (length(notes) <= 2000), plant_type_id uuid not null references public.plant_types(id), plant_spacing_cm numeric check (plant_spacing_cm > 0 and plant_spacing_cm <= 9007199254740991), row_spacing_cm numeric check (row_spacing_cm > 0 and row_spacing_cm <= 9007199254740991), border_distance_cm numeric check (border_distance_cm >= 5 and border_distance_cm <= 9007199254740991 and mod(border_distance_cm,5)=0), living_mulch_enabled boolean, unique(id,plant_type_id));
alter table public.plant_cultivars enable row level security;
revoke all on public.plant_cultivars from anon, authenticated;
grant select on public.plant_cultivars to authenticated;
grant insert (name, notes, plant_type_id, plant_spacing_cm, row_spacing_cm, border_distance_cm, living_mulch_enabled), update (name, notes, plant_type_id, plant_spacing_cm, row_spacing_cm, border_distance_cm, living_mulch_enabled) on public.plant_cultivars to authenticated;
create policy plant_cultivars_read on public.plant_cultivars for select to authenticated using (true);
create policy plant_cultivars_create on public.plant_cultivars for insert to authenticated with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create policy plant_cultivars_edit on public.plant_cultivars for update to authenticated using (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid()))) with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create trigger plant_cultivars_version before update on public.plant_cultivars for each row execute function public.myco_version_catalogue_entry();

create table public.plant_guidance (id uuid primary key default gen_random_uuid(), version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), plant_type_id uuid not null references public.plant_types(id), cultivar_id uuid, foreign key (cultivar_id, plant_type_id) references public.plant_cultivars(id, plant_type_id), sun_requirement text check(sun_requirement in ('full_sun','sun_or_part_shade')), tolerates_shade boolean, rotation_years integer check(rotation_years > 0 and rotation_years <= 100), organic_feed_level text check(organic_feed_level in ('low','medium','abundant')), feed_in_planting_hole boolean, monthly_feed boolean, reduce_water_before_harvest boolean, stop_water_before_harvest boolean, watering_notes text check(length(watering_notes)<=2000), unique nulls not distinct(plant_type_id,cultivar_id));
alter table public.plant_guidance enable row level security;
revoke all on public.plant_guidance from anon, authenticated;
grant select on public.plant_guidance to authenticated;
grant insert (plant_type_id, cultivar_id, sun_requirement, tolerates_shade, rotation_years, organic_feed_level, feed_in_planting_hole, monthly_feed, reduce_water_before_harvest, stop_water_before_harvest, watering_notes), update (plant_type_id, cultivar_id, sun_requirement, tolerates_shade, rotation_years, organic_feed_level, feed_in_planting_hole, monthly_feed, reduce_water_before_harvest, stop_water_before_harvest, watering_notes) on public.plant_guidance to authenticated;
create policy plant_guidance_read on public.plant_guidance for select to authenticated using (true);
create policy plant_guidance_create on public.plant_guidance for insert to authenticated with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create policy plant_guidance_edit on public.plant_guidance for update to authenticated using (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid()))) with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create trigger plant_guidance_version before update on public.plant_guidance for each row execute function public.myco_version_catalogue_entry();

create table public.plant_depths (id uuid primary key default gen_random_uuid(), version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), plant_type_id uuid not null references public.plant_types(id), cultivar_id uuid, foreign key (cultivar_id, plant_type_id) references public.plant_cultivars(id, plant_type_id), planting_method text not null default 'seed' check (planting_method in ('seed','crown','bulb','tuber','sucker','offset','plant')), depth_cm numeric not null check(depth_cm > 0 and depth_cm <= 1000), notes text not null default '' check(length(notes)<=2000), unique nulls not distinct(plant_type_id,cultivar_id,planting_method));
alter table public.plant_depths enable row level security;
revoke all on public.plant_depths from anon, authenticated;
grant select on public.plant_depths to authenticated;
grant insert (plant_type_id, cultivar_id, planting_method, depth_cm, notes), update (plant_type_id, cultivar_id, planting_method, depth_cm, notes) on public.plant_depths to authenticated;
create policy plant_depths_read on public.plant_depths for select to authenticated using (true);
create policy plant_depths_create on public.plant_depths for insert to authenticated with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create policy plant_depths_edit on public.plant_depths for update to authenticated using (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid()))) with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create trigger plant_depths_version before update on public.plant_depths for each row execute function public.myco_version_catalogue_entry();

create table public.calendar_profiles (id uuid primary key default gen_random_uuid(), version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), name text not null check (length(btrim(name)) between 1 and 100), notes text not null default '' check (length(notes) <= 2000), code text not null unique check(code ~ '^[a-z][a-z0-9_-]{0,63}$'));
alter table public.calendar_profiles enable row level security;
revoke all on public.calendar_profiles from anon, authenticated;
grant select on public.calendar_profiles to authenticated;
grant insert (name, notes, code), update (name, notes, code) on public.calendar_profiles to authenticated;
create policy calendar_profiles_read on public.calendar_profiles for select to authenticated using (true);
create policy calendar_profiles_create on public.calendar_profiles for insert to authenticated with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create policy calendar_profiles_edit on public.calendar_profiles for update to authenticated using (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid()))) with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create trigger calendar_profiles_version before update on public.calendar_profiles for each row execute function public.myco_version_catalogue_entry();

create table public.calendar_coverage (id uuid primary key default gen_random_uuid(), version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), calendar_profile_id uuid not null references public.calendar_profiles(id), country_code text not null check(country_code='IT'), region_code text not null unique check(region_code in ('IT-21','IT-23','IT-25','IT-32','IT-34','IT-36','IT-42','IT-45','IT-52','IT-55','IT-57','IT-62')));
alter table public.calendar_coverage enable row level security;
revoke all on public.calendar_coverage from anon, authenticated;
grant select on public.calendar_coverage to authenticated;
grant insert (calendar_profile_id, country_code, region_code), update (calendar_profile_id, country_code, region_code) on public.calendar_coverage to authenticated;
create policy calendar_coverage_read on public.calendar_coverage for select to authenticated using (true);
create policy calendar_coverage_create on public.calendar_coverage for insert to authenticated with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create policy calendar_coverage_edit on public.calendar_coverage for update to authenticated using (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid()))) with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create trigger calendar_coverage_version before update on public.calendar_coverage for each row execute function public.myco_version_catalogue_entry();

create table public.plant_calendar_entries (id uuid primary key default gen_random_uuid(), version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), plant_type_id uuid not null references public.plant_types(id), cultivar_id uuid, foreign key (cultivar_id, plant_type_id) references public.plant_cultivars(id, plant_type_id), calendar_profile_id uuid not null references public.calendar_profiles(id), activity text not null check(activity in ('seedbed_sowing','direct_sowing','transplant','harvest')), planting_method text not null default 'seed' check (planting_method in ('seed','crown','bulb','tuber','sucker','offset','plant')), notes text not null default '' check(length(notes)<=2000), unique nulls not distinct(calendar_profile_id,plant_type_id,cultivar_id,activity,planting_method));
alter table public.plant_calendar_entries enable row level security;
revoke all on public.plant_calendar_entries from anon, authenticated;
grant select on public.plant_calendar_entries to authenticated;
grant insert (plant_type_id, cultivar_id, calendar_profile_id, activity, planting_method, notes), update (plant_type_id, cultivar_id, calendar_profile_id, activity, planting_method, notes) on public.plant_calendar_entries to authenticated;
create policy plant_calendar_entries_read on public.plant_calendar_entries for select to authenticated using (true);
create policy plant_calendar_entries_create on public.plant_calendar_entries for insert to authenticated with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create policy plant_calendar_entries_edit on public.plant_calendar_entries for update to authenticated using (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid()))) with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create trigger plant_calendar_entries_version before update on public.plant_calendar_entries for each row execute function public.myco_version_catalogue_entry();

create table public.calendar_windows (id uuid primary key default gen_random_uuid(), version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), calendar_entry_id uuid not null references public.plant_calendar_entries(id), start_month integer not null check(start_month between 1 and 12), end_month integer not null check(end_month between 1 and 12), unique(calendar_entry_id,start_month,end_month));
alter table public.calendar_windows enable row level security;
revoke all on public.calendar_windows from anon, authenticated;
grant select on public.calendar_windows to authenticated;
grant insert (calendar_entry_id, start_month, end_month), update (calendar_entry_id, start_month, end_month) on public.calendar_windows to authenticated;
create policy calendar_windows_read on public.calendar_windows for select to authenticated using (true);
create policy calendar_windows_create on public.calendar_windows for insert to authenticated with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create policy calendar_windows_edit on public.calendar_windows for update to authenticated using (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid()))) with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create trigger calendar_windows_version before update on public.calendar_windows for each row execute function public.myco_version_catalogue_entry();

create table public.rotation_rules (id uuid primary key default gen_random_uuid(), version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), current_family_id uuid references public.plant_families(id), current_plant_id uuid references public.plant_types(id), previous_family_id uuid references public.plant_families(id), previous_plant_id uuid references public.plant_types(id), relationship text not null check(relationship in ('favourable_after','avoid_after')), notes text not null default '' check(length(notes)<=2000), check(num_nonnulls(current_family_id,current_plant_id)=1), check(num_nonnulls(previous_family_id,previous_plant_id)=1), unique nulls not distinct(current_family_id,current_plant_id,previous_family_id,previous_plant_id));
alter table public.rotation_rules enable row level security;
revoke all on public.rotation_rules from anon, authenticated;
grant select on public.rotation_rules to authenticated;
grant insert (current_family_id, current_plant_id, previous_family_id, previous_plant_id, relationship, notes), update (current_family_id, current_plant_id, previous_family_id, previous_plant_id, relationship, notes) on public.rotation_rules to authenticated;
create policy rotation_rules_read on public.rotation_rules for select to authenticated using (true);
create policy rotation_rules_create on public.rotation_rules for insert to authenticated with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create policy rotation_rules_edit on public.rotation_rules for update to authenticated using (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid()))) with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create trigger rotation_rules_version before update on public.rotation_rules for each row execute function public.myco_version_catalogue_entry();

create table public.mulch_categories (id uuid primary key default gen_random_uuid(), version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), name text not null check (length(btrim(name)) between 1 and 100), notes text not null default '' check (length(notes) <= 2000), code text not null unique check(code in ('organic','synthetic','living')));
alter table public.mulch_categories enable row level security;
revoke all on public.mulch_categories from anon, authenticated;
grant select on public.mulch_categories to authenticated;
grant insert (name, notes, code), update (name, notes, code) on public.mulch_categories to authenticated;
create policy mulch_categories_read on public.mulch_categories for select to authenticated using (true);
create policy mulch_categories_create on public.mulch_categories for insert to authenticated with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create policy mulch_categories_edit on public.mulch_categories for update to authenticated using (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid()))) with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create trigger mulch_categories_version before update on public.mulch_categories for each row execute function public.myco_version_catalogue_entry();

create table public.catalogue_import_sources (id uuid primary key default gen_random_uuid(), version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source_key text not null unique, filename text not null, row_number integer not null check(row_number>0), source_data jsonb not null check(jsonb_typeof(source_data)='object'), plant_type_id uuid references public.plant_types(id), mapping_notes text not null default '' check(length(mapping_notes)<=2000));
alter table public.catalogue_import_sources enable row level security;
revoke all on public.catalogue_import_sources from anon, authenticated;
grant select on public.catalogue_import_sources to authenticated;
grant insert (source_key, filename, row_number, source_data, plant_type_id, mapping_notes), update (source_key, filename, row_number, source_data, plant_type_id, mapping_notes) on public.catalogue_import_sources to authenticated;
create policy catalogue_import_sources_read on public.catalogue_import_sources for select to authenticated using (true);
create policy catalogue_import_sources_create on public.catalogue_import_sources for insert to authenticated with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create policy catalogue_import_sources_edit on public.catalogue_import_sources for update to authenticated using (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid()))) with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create trigger catalogue_import_sources_version before update on public.catalogue_import_sources for each row execute function public.myco_version_catalogue_entry();

create table public.catalogue_import_decisions (id uuid primary key default gen_random_uuid(), version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source_id uuid not null references public.catalogue_import_sources(id), field_name text not null check(field_name in ('plant_spacing_cm','row_spacing_cm')), chosen_value numeric not null check(chosen_value>0 and chosen_value<=9007199254740991), notes text not null default '' check(length(notes)<=2000), unique(source_id,field_name));
alter table public.catalogue_import_decisions enable row level security;
revoke all on public.catalogue_import_decisions from anon, authenticated;
grant select on public.catalogue_import_decisions to authenticated;
grant insert (source_id, field_name, chosen_value, notes), update (source_id, field_name, chosen_value, notes) on public.catalogue_import_decisions to authenticated;
create policy catalogue_import_decisions_read on public.catalogue_import_decisions for select to authenticated using (true);
create policy catalogue_import_decisions_create on public.catalogue_import_decisions for insert to authenticated with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create policy catalogue_import_decisions_edit on public.catalogue_import_decisions for update to authenticated using (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid()))) with check (exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())));
create trigger catalogue_import_decisions_version before update on public.catalogue_import_decisions for each row execute function public.myco_version_catalogue_entry();

create unique index plant_cultivars_name_idx on public.plant_cultivars(plant_type_id,lower(btrim(name)));

-- Seed classifications and calendar coverage only; horticultural recommendations
-- are imported separately after the spacing review.
insert into public.mulch_categories(code,name) values ('organic','Organic mulch'),('synthetic','Synthetic mulch'),('living','Living mulch');
insert into public.calendar_profiles(code,name,notes) values ('central-northern-italy','Central and northern Italy','Reference calendar for central and northern Italy, including Pianura Padana.');
insert into public.calendar_coverage(calendar_profile_id,country_code,region_code)
select id,'IT',region from public.calendar_profiles cross join unnest(array['IT-21','IT-23','IT-25','IT-32','IT-34','IT-36','IT-42','IT-45','IT-52','IT-55','IT-57','IT-62']) region
where code='central-northern-italy';

alter table public.mulch_types add column category_id uuid references public.mulch_categories(id),
 add column plant_type_id uuid references public.plant_types(id), add column cultivar_id uuid,
 add constraint mulch_cultivar_crop_fk foreign key(cultivar_id,plant_type_id) references public.plant_cultivars(id,plant_type_id),
 add constraint mulch_cultivar_requires_crop check(cultivar_id is null or plant_type_id is not null);
grant insert(category_id,plant_type_id,cultivar_id), update(category_id,plant_type_id,cultivar_id) on public.mulch_types to authenticated;

create function public.myco_check_living_material() returns trigger language plpgsql set search_path='' as $$
declare category text; eligible boolean;
begin
 if tg_op='INSERT' and new.category_id is null then raise exception 'Choose a mulch category' using errcode='23514'; end if;
 select code into category from public.mulch_categories where id=new.category_id;
 if category='living' then
   select coalesce(c.living_mulch_enabled,p.living_mulch_enabled) into eligible
   from public.plant_types p left join public.plant_cultivars c on c.id=new.cultivar_id and c.plant_type_id=p.id where p.id=new.plant_type_id;
   -- Preserve references on unrelated edits after eligibility was revoked.
   if tg_op='UPDATE' then
     if new.plant_type_id is not distinct from old.plant_type_id and new.cultivar_id is not distinct from old.cultivar_id and new.category_id is not distinct from old.category_id then return new; end if;
   end if;
   if eligible is distinct from true then raise exception 'Living mulch requires an eligible plant' using errcode='23514'; end if;
 elsif new.plant_type_id is not null or new.cultivar_id is not null then
   raise exception 'Only living mulch can reference plants' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function public.myco_check_living_material() from public;
create trigger mulch_living_reference before insert or update on public.mulch_types for each row execute function public.myco_check_living_material();

-- Child guidance edits invalidate the parent catalogue revision as well.
create function public.myco_touch_guidance_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.cultivar_id is null then update public.plant_types set notes=notes where id=new.plant_type_id;
 else update public.plant_cultivars set notes=notes where id=new.cultivar_id; end if;
 if tg_op='UPDATE' and (old.plant_type_id,old.cultivar_id) is distinct from (new.plant_type_id,new.cultivar_id) then
   if old.cultivar_id is null then update public.plant_types set notes=notes where id=old.plant_type_id;
   else update public.plant_cultivars set notes=notes where id=old.cultivar_id; end if;
 end if;
 return new;
end; $$;
revoke all on function public.myco_touch_guidance_owner() from public;
create trigger plant_guidance_touch_owner after insert or update on public.plant_guidance for each row execute function public.myco_touch_guidance_owner();
create trigger plant_depths_touch_owner after insert or update on public.plant_depths for each row execute function public.myco_touch_guidance_owner();
create trigger plant_calendar_entries_touch_owner after insert or update on public.plant_calendar_entries for each row execute function public.myco_touch_guidance_owner();

-- Atomic calendar editing: replace month windows with an optimistic entry lock.
create function public.myco_save_calendar_entry(entry_id uuid, expected_version bigint, details jsonb, windows jsonb)
returns public.plant_calendar_entries language plpgsql security definer set search_path='' as $$
declare saved public.plant_calendar_entries; item jsonb;
begin
 if not exists(select 1 from public.catalogue_administrators where user_id=auth.uid()) then raise exception 'Only catalogue administrators can edit calendars' using errcode='42501'; end if;
 if jsonb_typeof(windows) is distinct from 'array' or jsonb_array_length(windows)>24 then raise exception 'Invalid calendar windows' using errcode='23514'; end if;
 if entry_id is null then
   insert into public.plant_calendar_entries(plant_type_id,cultivar_id,calendar_profile_id,activity,planting_method,notes)
   values ((details->>'plant_type_id')::uuid,(details->>'cultivar_id')::uuid,(details->>'calendar_profile_id')::uuid,details->>'activity',details->>'planting_method',coalesce(details->>'notes','')) returning * into saved;
 else
   update public.plant_calendar_entries set plant_type_id=(details->>'plant_type_id')::uuid,cultivar_id=(details->>'cultivar_id')::uuid,
   calendar_profile_id=(details->>'calendar_profile_id')::uuid,activity=details->>'activity',planting_method=details->>'planting_method',notes=coalesce(details->>'notes','')
   where id=entry_id and version=expected_version returning * into saved;
   if not found then raise exception 'Calendar changed; refresh before editing' using errcode='40001'; end if;
   delete from public.calendar_windows where calendar_entry_id=entry_id;
 end if;
 for item in select jsonb_array_elements(windows) loop
   insert into public.calendar_windows(calendar_entry_id,start_month,end_month) values(saved.id,(item->>'start_month')::integer,(item->>'end_month')::integer);
 end loop;
 return saved;
end; $$;
revoke all on function public.myco_save_calendar_entry(uuid,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.myco_save_calendar_entry(uuid,bigint,jsonb,jsonb) to authenticated;
-- Windows are written only by the atomic entry operation.
revoke insert(calendar_entry_id,start_month,end_month), update(calendar_entry_id,start_month,end_month) on public.calendar_windows from authenticated;

alter table public.gardens add column location jsonb;
grant insert(location),update(location) on public.gardens to authenticated;
create function public.myco_check_garden_location() returns trigger language plpgsql set search_path='' as $$
begin
 if new.location is null then
   if tg_op='INSERT' then raise exception 'A supported garden location is required' using errcode='23514'; end if;
   if old.location is not null then raise exception 'Garden location cannot be cleared' using errcode='23514'; end if;
   return new;
 end if;
 -- An unchanged location remains valid if coverage is subsequently edited.
 if tg_op='UPDATE' then if new.location is not distinct from old.location then return new; end if; end if;
 if jsonb_typeof(new.location) is distinct from 'object'
   or jsonb_typeof(new.location->'enteredLocation') is distinct from 'string'
   or length(btrim(new.location->>'enteredLocation')) not between 1 and 500
   or jsonb_typeof(new.location->'displayName') is distinct from 'string'
   or length(btrim(new.location->>'displayName')) not between 1 and 1000
   or jsonb_typeof(new.location->'latitude') is distinct from 'number'
   or jsonb_typeof(new.location->'longitude') is distinct from 'number'
   or (new.location->>'latitude')::numeric not between -90 and 90
   or (new.location->>'longitude')::numeric not between -180 and 180
   or not exists(select 1 from public.calendar_coverage where country_code=new.location->>'countryCode' and region_code=new.location->>'regionCode')
 then raise exception 'Choose a resolved location in central or northern Italy' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function public.myco_check_garden_location() from public;
create trigger garden_location before insert or update of location on public.gardens for each row execute function public.myco_check_garden_location();

-- These snapshot fields are optional for old plans, but validated when present.
create function public.myco_valid_catalogue_snapshots(beds jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare bed jsonb; area jsonb; plant jsonb; layer jsonb; material jsonb; field text;
begin
 for bed in select jsonb_array_elements(beds) loop
  for area in select jsonb_array_elements(coalesce(bed->'plantingPlan'->'areas','[]'::jsonb)) loop
   plant:=area->'plant';
   if plant ?| array['cultivarId','cultivarName','cultivarVersion'] then
    if jsonb_typeof(plant->'cultivarId') is distinct from 'string' or length(btrim(plant->>'cultivarId')) not between 1 and 128
     or jsonb_typeof(plant->'cultivarName') is distinct from 'string' or length(btrim(plant->>'cultivarName')) not between 1 and 100
     or jsonb_typeof(plant->'cultivarVersion') is distinct from 'number'
     or (plant->>'cultivarVersion')::numeric < 1 or (plant->>'cultivarVersion')::numeric > 9007199254740991
     or mod((plant->>'cultivarVersion')::numeric,1)<>0 then return false; end if;
   end if;
  end loop;
  for area in select jsonb_array_elements(coalesce(bed->'mulchPlan'->'areas','[]'::jsonb)) loop
   for layer in select jsonb_array_elements(area->'layers') loop
    material:=layer->'material';
    foreach field in array array['categoryId','plantTypeId','cultivarId'] loop
     if material ? field and material->field<>'null'::jsonb and (jsonb_typeof(material->field) is distinct from 'string' or length(btrim(material->>field)) not between 1 and 128) then return false; end if;
    end loop;
    if material ? 'cultivarId' and material->'cultivarId'<>'null'::jsonb and (material->'plantTypeId' is null or material->'plantTypeId'='null'::jsonb) then return false; end if;
   end loop;
  end loop;
 end loop;
 return true;
exception when others then return false;
end; $$;
revoke all on function public.myco_valid_catalogue_snapshots(jsonb) from public;
grant execute on function public.myco_valid_catalogue_snapshots(jsonb) to authenticated;
alter table public.gardens add constraint gardens_catalogue_snapshots check(public.myco_valid_catalogue_snapshots(beds));
alter table public.garden_layout_events add constraint history_catalogue_snapshots check(public.myco_valid_catalogue_snapshots(snapshot->'beds'));

create function public.myco_check_new_living_layers() returns trigger language plpgsql set search_path='' as $$
declare bed jsonb; area jsonb; layer jsonb; previous_beds jsonb; eligible boolean;
begin
 previous_beds := case when tg_op='INSERT' then '[]'::jsonb else old.beds end;
 for bed in select jsonb_array_elements(new.beds) loop
  for area in select jsonb_array_elements(coalesce(bed->'mulchPlan'->'areas','[]'::jsonb)) loop
   for layer in select jsonb_array_elements(area->'layers') loop
    if exists(select 1 from jsonb_array_elements(previous_beds) b
      cross join lateral jsonb_array_elements(coalesce(b->'mulchPlan'->'areas','[]'::jsonb)) a
      cross join lateral jsonb_array_elements(a->'layers') l
      where b->>'id'=bed->>'id' and l->>'id'=layer->>'id' and l->'material'=layer->'material') then continue; end if;
    select coalesce(c.living_mulch_enabled,p.living_mulch_enabled,false) into eligible
      from public.mulch_types m join public.mulch_categories category on category.id=m.category_id and category.code='living'
      join public.plant_types p on p.id=m.plant_type_id left join public.plant_cultivars c on c.id=m.cultivar_id
      where m.id::text=layer->'material'->>'id';
    if eligible is false then raise exception 'This plant is no longer eligible for new living mulch layers' using errcode='23514'; end if;
   end loop;
  end loop;
 end loop;
 return new;
end; $$;
revoke all on function public.myco_check_new_living_layers() from public;
create trigger new_living_layers before insert or update of beds on public.gardens for each row execute function public.myco_check_new_living_layers();

-- Coverage changes invalidate the parent calendar's loaded version.
create function public.myco_touch_calendar_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.calendar_profiles set notes=notes where id=new.calendar_profile_id;
 if tg_op='UPDATE' and old.calendar_profile_id<>new.calendar_profile_id then update public.calendar_profiles set notes=notes where id=old.calendar_profile_id; end if;
 return new;
end; $$;
revoke all on function public.myco_touch_calendar_profile() from public;
create trigger calendar_coverage_touch after insert or update on public.calendar_coverage for each row execute function public.myco_touch_calendar_profile();
create trigger calendar_entry_touch after insert or update on public.plant_calendar_entries for each row execute function public.myco_touch_calendar_profile();

notify pgrst,'reload schema';
commit;
