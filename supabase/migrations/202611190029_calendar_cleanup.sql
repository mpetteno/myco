-- Preserve active months while removing redundant imported calendar content.
begin;

create or replace function public.myco_normalize_calendar_windows(windows jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare
  active boolean[] := array_fill(false, array[12]);
  item jsonb; first_month integer; last_month integer; m integer; ending integer;
  result jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(windows) is distinct from 'array' or jsonb_array_length(windows)>24 then
    raise exception 'Invalid calendar windows' using errcode='23514';
  end if;
  for item in select jsonb_array_elements(windows) loop
    if jsonb_typeof(item->'start_month') is distinct from 'number'
      or jsonb_typeof(item->'end_month') is distinct from 'number'
      or coalesce(item->>'start_month','') !~ '^([1-9]|1[0-2])$'
      or coalesce(item->>'end_month','') !~ '^([1-9]|1[0-2])$' then
      raise exception 'Months must be integers between 1 and 12' using errcode='23514';
    end if;
    first_month := (item->>'start_month')::integer;
    last_month := (item->>'end_month')::integer;
    for m in 1..12 loop
      if (first_month<=last_month and m between first_month and last_month)
        or (first_month>last_month and (m>=first_month or m<=last_month)) then active[m] := true; end if;
    end loop;
  end loop;
  if active = array_fill(true,array[12]) then return '[{"start_month":1,"end_month":12}]'::jsonb; end if;
  for m in 1..12 loop
    if active[m] and not active[case when m=1 then 12 else m-1 end] then
      ending := m;
      while active[ending%12+1] loop ending := ending%12+1; end loop;
      result := result || jsonb_build_array(jsonb_build_object('start_month',m,'end_month',ending));
    end if;
  end loop;
  return result;
end; $$;

-- Match only exact legacy English range strings; meaningful notes remain intact.
create or replace function public.myco_calendar_range_text(windows jsonb)
returns text language sql immutable set search_path='' as $$
  select coalesce(string_agg(
    (array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])[(item->>'start_month')::integer]
    || case when item->>'start_month'=item->>'end_month' then '' else '-' ||
      (array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])[(item->>'end_month')::integer] end,
    '; ' order by (item->>'start_month')::integer, (item->>'end_month')::integer), '')
  from jsonb_array_elements(windows) item;
$$;
revoke all on function public.myco_normalize_calendar_windows(jsonb), public.myco_calendar_range_text(jsonb) from public, anon, authenticated;

-- Keep the original rows, including versions, for administrative rollback.
create table if not exists public.calendar_cleanup_backup_202611190029 (
  entry_id uuid primary key, entry_data jsonb not null, window_data jsonb not null,
  captured_at timestamptz not null default now()
);
alter table public.calendar_cleanup_backup_202611190029 enable row level security;
revoke all on public.calendar_cleanup_backup_202611190029 from public, anon, authenticated;

lock table public.plant_calendar_entries, public.calendar_windows in share row exclusive mode;
do $$
declare entry public.plant_calendar_entries; old_windows jsonb; canonical jsonb; raw_windows jsonb; next_notes text;
begin
  for entry in select * from public.plant_calendar_entries order by id for update loop
    select coalesce(jsonb_agg(to_jsonb(w) order by start_month,end_month),'[]'::jsonb),
      coalesce(jsonb_agg(jsonb_build_object('start_month',start_month,'end_month',end_month) order by start_month,end_month),'[]'::jsonb)
      into raw_windows,old_windows
    from public.calendar_windows w where calendar_entry_id=entry.id;
    canonical := public.myco_normalize_calendar_windows(old_windows);
    next_notes := case when entry.notes=public.myco_calendar_range_text(old_windows) then '' else entry.notes end;
    if canonical is distinct from old_windows or next_notes is distinct from entry.notes then
      insert into public.calendar_cleanup_backup_202611190029(entry_id,entry_data,window_data)
        values(entry.id,to_jsonb(entry),raw_windows) on conflict(entry_id) do nothing;
      update public.plant_calendar_entries set notes=next_notes where id=entry.id;
      if canonical is distinct from old_windows then
        delete from public.calendar_windows where calendar_entry_id=entry.id;
        insert into public.calendar_windows(calendar_entry_id,start_month,end_month)
          select entry.id,(item->>'start_month')::integer,(item->>'end_month')::integer
          from jsonb_array_elements(canonical) item;
      end if;
    end if;
  end loop;
end; $$;

create or replace function public.myco_save_calendar_entry(entry_id uuid, expected_version bigint, details jsonb, windows jsonb)
returns public.plant_calendar_entries language plpgsql security definer set search_path='' as $$
declare saved public.plant_calendar_entries; item jsonb;
begin
 if not exists(select 1 from public.catalogue_administrators where user_id=auth.uid()) then raise exception 'Only catalogue administrators can edit calendars' using errcode='42501'; end if;
 if jsonb_typeof(windows) is distinct from 'array' or jsonb_array_length(windows)>24 then raise exception 'Invalid calendar windows' using errcode='23514'; end if;
 details := jsonb_set(details, '{notes}', to_jsonb(case when coalesce(details->>'notes','') = public.myco_calendar_range_text(windows) then '' else coalesce(details->>'notes','') end));
 windows := public.myco_normalize_calendar_windows(windows);
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

commit;
