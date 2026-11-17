begin;

-- Region selects the calendar; city is an optional label. No coordinates are
-- invented or required. Existing resolved locations and future geocoding remain valid.
create or replace function public.myco_check_garden_location() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.location is null then
    if tg_op='INSERT' then raise exception 'A supported garden region is required' using errcode='23514'; end if;
    if old.location is not null then raise exception 'Garden location cannot be cleared' using errcode='23514'; end if;
    return new;
  end if;
  -- Existing locations remain usable if coverage is subsequently changed.
  if tg_op='UPDATE' then
    if new.location is not distinct from old.location then return new; end if;
  end if;
  if jsonb_typeof(new.location) is distinct from 'object'
    or jsonb_typeof(new.location->'displayName') is distinct from 'string'
    or length(btrim(new.location->>'displayName')) not between 1 and 1000
    or new.location->>'countryCode' is distinct from 'IT'
    or not exists (
      select 1 from public.calendar_coverage
      where country_code=new.location->>'countryCode' and region_code=new.location->>'regionCode'
    ) then raise exception 'Choose a supported garden region' using errcode='23514'; end if;
  if new.location ? 'city' then
    if jsonb_typeof(new.location->'city') is distinct from 'string' or length(new.location->>'city')>100 then
      raise exception 'City must be text of at most 100 characters' using errcode='23514';
    end if;
  end if;
  if new.location ? 'enteredLocation' then
    if jsonb_typeof(new.location->'enteredLocation') is distinct from 'string'
      or length(btrim(new.location->>'enteredLocation')) not between 1 and 500 then
      raise exception 'Invalid original location label' using errcode='23514';
    end if;
  end if;
  if new.location ? 'latitude' or new.location ? 'longitude' then
    if jsonb_typeof(new.location->'latitude') is distinct from 'number'
      or jsonb_typeof(new.location->'longitude') is distinct from 'number' then
      raise exception 'Provide both coordinates or omit them' using errcode='23514';
    end if;
    if (new.location->>'latitude')::numeric not between -90 and 90
      or (new.location->>'longitude')::numeric not between -180 and 180 then
      raise exception 'Invalid coordinates' using errcode='23514';
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.myco_check_garden_location() from public;

notify pgrst, 'reload schema';
commit;
