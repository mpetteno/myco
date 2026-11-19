-- Optional data rollback. Refuse to overwrite any activity edited after cleanup.
-- Future RPC saves still normalize windows; this restores only the backed-up data.
begin;
lock table public.plant_calendar_entries, public.calendar_windows in share row exclusive mode;
do $$
declare backup record; current_version bigint;
begin
  for backup in select * from public.calendar_cleanup_backup_202611190029 order by entry_id loop
    select version into current_version from public.plant_calendar_entries where id=backup.entry_id for update;
    if not found or current_version <> (backup.entry_data->>'version')::bigint + 1 then
      raise exception 'Calendar entry % changed after cleanup; review the backup before restoring', backup.entry_id;
    end if;
    update public.plant_calendar_entries set notes=backup.entry_data->>'notes' where id=backup.entry_id;
    delete from public.calendar_windows where calendar_entry_id=backup.entry_id;
    insert into public.calendar_windows
      select * from jsonb_populate_recordset(null::public.calendar_windows,backup.window_data);
  end loop;
end; $$;
commit;
