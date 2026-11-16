begin;

create table public.garden_members (
  garden_id uuid not null references public.gardens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (garden_id, user_id)
);
create index garden_members_user_idx on public.garden_members(user_id);

alter table public.garden_members enable row level security;
revoke all on public.garden_members from anon, authenticated;
grant select on public.garden_members to authenticated;

-- Reading only one's own memberships avoids recursive garden/member policies.
create policy garden_members_read_self on public.garden_members for select to authenticated
using (user_id = (select auth.uid()));

drop policy gardens_read_owned on public.gardens;
drop policy gardens_update_owned on public.gardens;
create policy gardens_read_accessible on public.gardens for select to authenticated
using (
  owner_id = (select auth.uid()) or exists (
    select 1 from public.garden_members m
    where m.garden_id = gardens.id and m.user_id = (select auth.uid())
  )
);
create policy gardens_update_accessible on public.gardens for update to authenticated
using (
  owner_id = (select auth.uid()) or exists (
    select 1 from public.garden_members m
    where m.garden_id = gardens.id and m.user_id = (select auth.uid())
  )
)
with check (
  owner_id = (select auth.uid()) or exists (
    select 1 from public.garden_members m
    where m.garden_id = gardens.id and m.user_id = (select auth.uid())
  )
);

-- Definer functions keep auth.users private and membership writes owner-only.
-- Locking the garden serializes sharing changes; ownership cannot be transferred.
create function public.share_garden(p_garden_id uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  recipient uuid;
begin
  perform 1 from public.gardens
  where id = p_garden_id and owner_id = (select auth.uid()) for update;
  if not found then
    raise exception 'Only the garden owner can manage sharing' using errcode = '42501';
  end if;
  if p_email is null or length(btrim(p_email)) = 0 then
    raise exception 'Enter an email address' using errcode = '22023';
  end if;
  select id into recipient from auth.users
  where lower(email) = lower(btrim(p_email)) and email_confirmed_at is not null;
  if recipient is null then
    raise exception 'No confirmed account with this email address' using errcode = 'P0002';
  end if;
  if recipient = (select auth.uid()) then
    raise exception 'The owner already has access' using errcode = '22023';
  end if;
  insert into public.garden_members(garden_id, user_id) values (p_garden_id, recipient)
  on conflict (garden_id, user_id) do nothing;
end;
$$;

create function public.list_garden_members(p_garden_id uuid)
returns table(user_id uuid, email text)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.gardens where id = p_garden_id and owner_id = (select auth.uid())) then
    raise exception 'Only the garden owner can manage sharing' using errcode = '42501';
  end if;
  return query
  select m.user_id, u.email::text from public.garden_members m
  join auth.users u on u.id = m.user_id
  where m.garden_id = p_garden_id order by lower(u.email), m.user_id;
end;
$$;

create function public.unshare_garden(p_garden_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.gardens
  where id = p_garden_id and owner_id = (select auth.uid()) for update;
  if not found then
    raise exception 'Only the garden owner can manage sharing' using errcode = '42501';
  end if;
  delete from public.garden_members where garden_id = p_garden_id and user_id = p_user_id;
end;
$$;

revoke all on function public.share_garden(uuid, text) from public, anon, authenticated;
revoke all on function public.list_garden_members(uuid) from public, anon, authenticated;
revoke all on function public.unshare_garden(uuid, uuid) from public, anon, authenticated;
grant execute on function public.share_garden(uuid, text) to authenticated;
grant execute on function public.list_garden_members(uuid) to authenticated;
grant execute on function public.unshare_garden(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
