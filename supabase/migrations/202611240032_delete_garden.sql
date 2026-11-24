begin;

-- Keep direct DELETE revoked. Only the authenticated owner can remove the
-- locked, expected garden revision; its children retain their cascade rules.
create function public.delete_garden(p_garden_id uuid, p_expected_version bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  garden_owner uuid;
  garden_version bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_garden_id is null or p_expected_version is null or p_expected_version < 1 then
    raise exception 'A garden and expected revision are required' using errcode = '22023';
  end if;
  select owner_id, version into garden_owner, garden_version
  from public.gardens where id = p_garden_id for update;
  -- Safe retry if a successful response was lost or the owner already deleted it.
  if not found then return; end if;
  if garden_owner <> (select auth.uid()) then
    raise exception 'Only the garden owner can delete this garden' using errcode = '42501';
  end if;
  if garden_version <> p_expected_version then
    raise exception 'Garden revision changed' using errcode = '40001';
  end if;
  delete from public.gardens where id = p_garden_id;
end;
$$;

revoke all on function public.delete_garden(uuid, bigint) from public, anon, authenticated;
grant execute on function public.delete_garden(uuid, bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
