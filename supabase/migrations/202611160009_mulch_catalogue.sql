begin;

create table public.mulch_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  notes text not null default '' check (length(notes) <= 2000),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index mulch_types_name_idx on public.mulch_types(lower(btrim(name)));

create trigger mulch_types_version before update on public.mulch_types
for each row execute function public.myco_version_catalogue_entry();

alter table public.mulch_types enable row level security;
revoke all on public.mulch_types from anon, authenticated;
grant select on public.mulch_types to authenticated;
grant insert (name, notes), update (name, notes) on public.mulch_types to authenticated;

create policy mulch_types_read on public.mulch_types for select to authenticated using (true);
create policy mulch_types_create on public.mulch_types for insert to authenticated
with check (exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())));
create policy mulch_types_edit on public.mulch_types for update to authenticated
using (exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())))
with check (exists (select 1 from public.catalogue_administrators where user_id = (select auth.uid())));

notify pgrst, 'reload schema';
commit;
