begin;

create table public.garden_layout_events (
  id uuid primary key,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  event_order bigint generated always as identity unique,
  event_date date not null check (event_date between date '0001-01-01' and date '9999-12-31'),
  title text not null check (length(btrim(title)) between 1 and 120),
  notes text not null default '' check (length(notes) <= 2000),
  source_version bigint not null check (source_version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  recorded_at timestamptz not null default clock_timestamp(),
  actor_id uuid references auth.users(id) on delete set null
);
create index garden_layout_events_timeline_idx on public.garden_layout_events(garden_id, event_date, event_order);
create index garden_layout_events_record_order_idx on public.garden_layout_events(garden_id, event_order);
alter table public.garden_layout_events enable row level security;
revoke all on public.garden_layout_events from public, anon, authenticated;
revoke all on sequence public.garden_layout_events_event_order_seq from public, anon, authenticated;
grant select on public.garden_layout_events to authenticated;
create policy garden_layout_events_read on public.garden_layout_events for select to authenticated
using (exists (select 1 from public.gardens g where g.id = garden_id));

-- Only this owner/editor-checked operation can append a snapshot. Events cannot
-- be rewritten through the browser, and recording never changes the live layout.
create function public.record_garden_layout_event(
  p_garden_id uuid, p_expected_version bigint, p_event_id uuid,
  p_event_date date, p_title text, p_notes text
)
returns public.garden_layout_events
language plpgsql security definer set search_path = '' as $$
declare
  garden public.gardens;
  existing public.garden_layout_events;
  result public.garden_layout_events;
begin
  select g.* into garden
  from public.gardens g
  where g.id = p_garden_id and (
    g.owner_id = (select auth.uid()) or exists (
      select 1 from public.garden_members m
      where m.garden_id = g.id and m.user_id = (select auth.uid())
    )
  ) for update;
  if not found then
    raise exception 'Garden is unavailable or access was removed' using errcode = '42501';
  end if;
  if p_event_id is null or p_expected_version is null or p_expected_version < 1
    or p_event_date is null or p_event_date not between date '0001-01-01' and date '9999-12-31'
    or p_title is null or length(btrim(p_title)) not between 1 and 120
    or length(coalesce(p_notes, '')) > 2000 then
    raise exception 'Check the event date, title and notes' using errcode = '22023';
  end if;
  select e.* into existing from public.garden_layout_events e where e.id = p_event_id;
  if found then
    if existing.garden_id = p_garden_id and existing.actor_id = (select auth.uid())
      and existing.event_date = p_event_date and existing.title = btrim(p_title)
      and existing.notes = btrim(coalesce(p_notes, '')) then
      return existing;
    end if;
    raise exception 'This event request has already been used' using errcode = '22023';
  end if;
  if garden.version <> p_expected_version then
    raise exception 'Garden changed before the event could be recorded' using errcode = '40001';
  end if;
  insert into public.garden_layout_events(id, garden_id, event_date, title, notes, source_version, snapshot, actor_id)
  values (p_event_id, garden.id, p_event_date, btrim(p_title), btrim(coalesce(p_notes, '')), garden.version,
    jsonb_build_object('name', garden.name,
      'dimensions', jsonb_build_object('widthCm', garden.width_cm, 'lengthCm', garden.length_cm),
      'beds', garden.beds), (select auth.uid()))
  returning * into result;
  return result;
end;
$$;
revoke all on function public.record_garden_layout_event(uuid, bigint, uuid, date, text, text) from public, anon, authenticated;
grant execute on function public.record_garden_layout_event(uuid, bigint, uuid, date, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
