# Planning and recording completed work

There is one garden plan, including each bed's planting and mulch. Valid edits
save automatically to Supabase. The header shows **Saving…**, **All changes
saved** or **Save failed**. Wait for **All changes saved** before closing the app;
the saved plan reloads when you return. There is no separate Start work, proposal
copy or Apply plan step.

Edits enter the save queue immediately; changes during a request are coalesced
into the latest plan. Navigation waits for pending saves. A failed save keeps
the latest edits available for retry; conflicts offer an explicit reload.
Incomplete/invalid fields remain editable without replacing the last valid plan.
Fix them before leaving or discard them. Pending, failed or invalid edits warn
on browser unload; unsaved fields are held only in memory.

After implementing work physically, adjust the plan to match the result and
wait for it to save. In garden or bed **History**, choose **Record completed
activity**, select the bed and enter the actual completion
date, title and notes, and confirm the saved bed matches reality. This records
the entire bed (both planting and mulch) without changing the plan or confirming
other beds. **Record garden changes** records the entire garden after implementing
its plan. Recording waits for pending autosaves, checks the saved revision and
uses retry IDs to avoid duplicate entries. Planning alone creates no history.

## Bed history and area editing

The bed toolbar's **History** shows garden layout checkpoints and that bed's
completed records with the same calendar and event arrows. Saved formats retain
their geometry. **Focus area** enlarges a historical area read-only. Backdated
edits, corrections and deletion are described in [history](history.md).

Select a planting or mulch area and choose **Open area editor**, or double-click
it on desktop. Settings appear beside the drawing on desktop and below it on
phones, with a phone **Hide settings / Show settings** toggle. **Zoom out**,
**Zoom in** and **Fit area** help inspect or resize; the camera stays stable during
a drag and refits afterward. The 5 cm grid, distance guides, row clearances and
bed-relative cm coordinates remain unchanged. Move/resize checks include
neighbours outside the focus. **Back to bed** keeps the shared autosaved plan.

## Storage

Apply migrations in order through `202611170017_record_bed_changes.sql`.
The garden document is the only active planning document. Legacy open-work
storage remains retained in the database but is inaccessible through the retired
browser endpoints; pending copies are never merged into the plan automatically.
The completed-only RPC captures a checkpoint atomically, without applying another
bed snapshot. Owner/editor authorization, saved revisions and physical-scene
validation remain enforced. Outsiders, revoked users and anonymous users cannot
record history. Tests use isolated databases, not live user records.
