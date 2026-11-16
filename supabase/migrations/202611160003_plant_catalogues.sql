begin;

-- Administrator membership is provisioned by a trusted database administrator.
create table public.catalogue_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.catalogue_administrators enable row level security;
revoke all on public.catalogue_administrators from anon, authenticated;
grant select on public.catalogue_administrators to authenticated;
create policy catalogue_admin_read_self on public.catalogue_administrators for select to authenticated
using (user_id = (select auth.uid()));

create table public.plant_families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  notes text not null default '' check (length(notes) <= 2000),
  plant_spacing_cm numeric check (plant_spacing_cm > 0 and plant_spacing_cm <= 9007199254740991),
  row_spacing_cm numeric check (row_spacing_cm > 0 and row_spacing_cm <= 9007199254740991),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index plant_families_name_idx on public.plant_families(lower(btrim(name)));

create table public.plant_types (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.plant_families(id),
  name text not null check (length(btrim(name)) between 1 and 100),
  notes text not null default '' check (length(notes) <= 2000),
  plant_spacing_cm numeric check (plant_spacing_cm > 0 and plant_spacing_cm <= 9007199254740991),
  row_spacing_cm numeric check (row_spacing_cm > 0 and row_spacing_cm <= 9007199254740991),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index plant_types_family_name_idx on public.plant_types(family_id, lower(btrim(name)));

create table public.companion_rules (
  id uuid primary key default gen_random_uuid(),
  family_a_id uuid references public.plant_families(id),
  plant_a_id uuid references public.plant_types(id),
  family_b_id uuid references public.plant_families(id),
  plant_b_id uuid references public.plant_types(id),
  relationship text not null check (relationship in ('companion', 'caution')),
  notes text not null default '' check (length(notes) <= 2000),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_key text generated always as (coalesce('family:' || family_a_id::text, 'plant:' || plant_a_id::text)) stored,
  second_key text generated always as (coalesce('family:' || family_b_id::text, 'plant:' || plant_b_id::text)) stored,
  check (num_nonnulls(family_a_id, plant_a_id) = 1),
  check (num_nonnulls(family_b_id, plant_b_id) = 1),
  check (first_key <= second_key),
  unique (first_key, second_key)
);

create function public.myco_version_catalogue_entry()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id then
    raise exception 'Catalogue identity cannot be changed' using errcode = '42501';
  end if;
  new.version := old.version + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.myco_version_catalogue_entry() from public, anon, authenticated;

create trigger plant_families_version before update on public.plant_families
for each row execute function public.myco_version_catalogue_entry();
create trigger plant_types_version before update on public.plant_types
for each row execute function public.myco_version_catalogue_entry();
create trigger companion_rules_version before update on public.companion_rules
for each row execute function public.myco_version_catalogue_entry();

alter table public.plant_families enable row level security;
alter table public.plant_types enable row level security;
alter table public.companion_rules enable row level security;
revoke all on public.plant_families, public.plant_types, public.companion_rules from anon, authenticated;
grant select on public.plant_families, public.plant_types, public.companion_rules to authenticated;
grant insert (name, notes, plant_spacing_cm, row_spacing_cm), update (name, notes, plant_spacing_cm, row_spacing_cm)
on public.plant_families to authenticated;
grant insert (family_id, name, notes, plant_spacing_cm, row_spacing_cm), update (family_id, name, notes, plant_spacing_cm, row_spacing_cm)
on public.plant_types to authenticated;
grant insert (family_a_id, plant_a_id, family_b_id, plant_b_id, relationship, notes),
  update (family_a_id, plant_a_id, family_b_id, plant_b_id, relationship, notes)
on public.companion_rules to authenticated;

create policy plant_families_read on public.plant_families for select to authenticated using (true);
create policy plant_families_create on public.plant_families for insert to authenticated
with check (exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())));
create policy plant_families_edit on public.plant_families for update to authenticated
using (exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())))
with check (exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())));

create policy plant_types_read on public.plant_types for select to authenticated using (true);
create policy plant_types_create on public.plant_types for insert to authenticated
with check (exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())));
create policy plant_types_edit on public.plant_types for update to authenticated
using (exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())))
with check (exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())));

create policy companion_rules_read on public.companion_rules for select to authenticated using (true);
create policy companion_rules_create on public.companion_rules for insert to authenticated
with check (exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())));
create policy companion_rules_edit on public.companion_rules for update to authenticated
using (exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())))
with check (exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())));

notify pgrst, 'reload schema';
commit;
