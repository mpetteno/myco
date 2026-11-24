begin;

-- Instructions and progress are independent of the single editable garden plan.
create function public.myco_valid_task_work(p_items jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb; seen text[] := '{}';
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' then return false; end if;
  if jsonb_array_length(p_items)>100 then return false; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item)<>'object'
      or jsonb_typeof(item->'id') is distinct from 'string'
      or length(btrim(item->>'id')) not between 1 and 128
      or item->>'id'=any(seen)
      or jsonb_typeof(item->'text') is distinct from 'string'
      or length(btrim(item->>'text')) not between 1 and 500
      or jsonb_typeof(item->'done') is distinct from 'boolean'
      or item - array['id','text','done'] <> '{}'::jsonb then return false; end if;
    seen := array_append(seen,item->>'id');
  end loop;
  return true;
end; $$;
revoke all on function public.myco_valid_task_work(jsonb) from public,anon,authenticated;

alter table public.garden_tasks
  add column work_recap text not null default '' check(length(work_recap)<=4000),
  add column work_items jsonb not null default '[]'::jsonb check(public.myco_valid_task_work(work_items));

-- A separate endpoint keeps existing clients compatible. The original endpoint
-- does not assign the new columns, so legacy edits/cancellation preserve them.
create function public.save_garden_task_work(
  p_garden_id uuid,p_task_id uuid,p_expected_version bigint,p_request_id uuid,
  p_bed_id text,p_activity_type text,p_planned_date date,p_title text,p_notes text,
  p_cancel boolean,p_work_recap text,p_work_items jsonb
) returns public.garden_tasks language plpgsql security definer set search_path='' as $$
declare garden public.gardens; existing public.garden_tasks; result public.garden_tasks; payload jsonb;
begin
  garden := public.myco_activity_garden(p_garden_id);
  if p_request_id is null or p_task_id is null or p_cancel is null
    or p_work_recap is null or length(p_work_recap)>4000
    or not public.myco_valid_task_work(p_work_items) then
    raise exception 'Check recap and work checklist' using errcode='22023';
  end if;
  payload := jsonb_build_array('work',p_bed_id,p_activity_type,p_planned_date,btrim(p_title),btrim(coalesce(p_notes,'')),p_cancel,btrim(p_work_recap),p_work_items);
  select * into existing from public.garden_tasks where id=p_task_id for update;
  if found then
    if existing.garden_id<>garden.id then raise exception 'Task unavailable' using errcode='42501'; end if;
    if existing.last_request_id=p_request_id and existing.last_request_actor=(select auth.uid()) then
      if existing.last_request_payload=payload then return existing; end if;
      raise exception 'Request already used' using errcode='22023';
    end if;
  end if;
  result := public.save_garden_task(garden.id,p_task_id,p_expected_version,p_request_id,p_bed_id,p_activity_type,p_planned_date,p_title,p_notes,p_cancel);
  update public.garden_tasks set work_recap=btrim(p_work_recap),work_items=p_work_items,last_request_payload=payload
  where id=result.id returning * into result;
  return result;
end; $$;
revoke all on function public.save_garden_task_work(uuid,uuid,bigint,uuid,text,text,date,text,text,boolean,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_garden_task_work(uuid,uuid,bigint,uuid,text,text,date,text,text,boolean,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
