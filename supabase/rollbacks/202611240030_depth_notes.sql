-- Restore only records still unchanged since this cleanup. Run as the database owner.
-- Materials are deliberately retained: gardens may already refer to them.
begin;
update public.plant_depths d
set notes = backup.row_data->>'notes'
from public.plant_depth_notes_backup_202611240030 backup
where d.id = backup.id and d.notes = ''
  and d.depth_cm = (backup.row_data->>'depth_cm')::numeric
  and d.version = (backup.row_data->>'version')::bigint + 1;
commit;
