begin;

create function public.myco_valid_garden_layout(w bigint, l bigint, beds jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  bed jsonb;
  field text;
  value numeric;
begin
  if w is null or l is null or beds is null
    or w < 5 or l < 5 or w > 9007199254740991 or l > 9007199254740991
    or w % 5 <> 0 or l % 5 <> 0 or jsonb_typeof(beds) is distinct from 'array' then
    return false;
  end if;
  for bed in select jsonb_array_elements(beds) loop
    if jsonb_typeof(bed) <> 'object'
      or jsonb_typeof(bed->'id') is distinct from 'string'
      or jsonb_typeof(bed->'name') is distinct from 'string'
      or length(btrim(bed->>'id')) = 0 or length(btrim(bed->>'name')) = 0 then
      return false;
    end if;
    foreach field in array array['xCm', 'yCm', 'widthCm', 'lengthCm'] loop
      if jsonb_typeof(bed->field) is distinct from 'number' then return false; end if;
      value := (bed->>field)::numeric;
      if value <> trunc(value) or mod(value, 5) <> 0
        or value < 0 or value > 9007199254740991 then return false; end if;
    end loop;
    if (bed->>'widthCm')::numeric < 5 or (bed->>'lengthCm')::numeric < 5
      or (bed->>'xCm')::numeric + (bed->>'widthCm')::numeric > w
      or (bed->>'yCm')::numeric + (bed->>'lengthCm')::numeric > l then
      return false;
    end if;
  end loop;
  if (select count(*) <> count(distinct item->>'id') from jsonb_array_elements(beds) item) then
    return false;
  end if;
  return not exists (
    select 1 from jsonb_array_elements(beds) with ordinality a(bed, n)
    join jsonb_array_elements(beds) with ordinality b(bed, n) on a.n < b.n
    where (a.bed->>'xCm')::numeric < (b.bed->>'xCm')::numeric + (b.bed->>'widthCm')::numeric
      and (a.bed->>'xCm')::numeric + (a.bed->>'widthCm')::numeric > (b.bed->>'xCm')::numeric
      and (a.bed->>'yCm')::numeric < (b.bed->>'yCm')::numeric + (b.bed->>'lengthCm')::numeric
      and (a.bed->>'yCm')::numeric + (a.bed->>'lengthCm')::numeric > (b.bed->>'yCm')::numeric
  );
end;
$$;

create table public.gardens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  width_cm bigint not null,
  length_cm bigint not null,
  beds jsonb not null default '[]'::jsonb,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gardens_valid_layout check (public.myco_valid_garden_layout(width_cm, length_cm, beds))
);
create index gardens_owner_updated_idx on public.gardens(owner_id, updated_at desc);

create function public.myco_version_garden()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id or new.id <> old.id then
    raise exception 'Garden identity cannot be changed' using errcode = '42501';
  end if;
  new.version := old.version + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger gardens_version before update on public.gardens
for each row execute function public.myco_version_garden();

alter table public.gardens enable row level security;
revoke all on public.gardens from anon, authenticated;
grant select on public.gardens to authenticated;
grant insert (owner_id, name, width_cm, length_cm, beds) on public.gardens to authenticated;
grant update (name, width_cm, length_cm, beds) on public.gardens to authenticated;

create policy gardens_read_owned on public.gardens for select to authenticated
using (owner_id = (select auth.uid()));
create policy gardens_create_owned on public.gardens for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy gardens_update_owned on public.gardens for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

revoke all on function public.myco_valid_garden_layout(bigint, bigint, jsonb) from public;
grant execute on function public.myco_valid_garden_layout(bigint, bigint, jsonb) to authenticated;
revoke all on function public.myco_version_garden() from public;

commit;
