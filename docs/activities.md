# Planning and recording completed work

There is one garden plan, including each bed's planting and mulch. Valid edits
save automatically to Supabase. The header shows **Saving…** only while a save is pending, separately from
the garden selector. It clears on success. A failed save shows an error and
**Retry save**; keep the app open until it succeeds. There is no separate Start
work, proposal copy or Apply plan step.

Edits enter the save queue immediately; changes during a request are coalesced
into the latest plan. Navigation waits for pending saves. A failed save keeps
the latest edits available for retry; conflicts offer an explicit reload.
Incomplete/invalid fields remain editable without replacing the last valid plan.
Fix them before leaving or discard them. Pending, failed or invalid edits warn
on browser unload; unsaved fields are held only in memory.

After implementing work physically, adjust the plan to match the result and
wait for it to save. In the garden or bed **Calendar**, choose **Record bed changes**, select the bed and enter the actual completion
date, title and notes, and confirm the saved bed matches reality. This records
the entire bed (both planting and mulch) without changing the plan or confirming
other beds. **Record garden changes** records the entire garden after implementing
its plan. Recording waits for pending autosaves, checks the saved revision and
uses retry IDs to avoid duplicate entries. Planning alone creates no history.

## Dated tasks and the combined calendar

Open **Calendar** from either editor toolbar. **Open full calendar** provides the full workspace view. **Work** combines dated
tasks and completed garden/bed history in a month grid and agenda. Filter the
current garden, selected gardens or all accessible gardens; narrow by bed,
activity and status. Choose a day, Whole month or All dates. Overdue uses the
device’s local date and does not change the stored task status. Cancelled tasks
remain available through the Cancelled filter.

**Plan activity** saves garden, optional bed, activity, planned date, title,
notes and reviewed work instructions. The current garden remains the single editable plan. Edit a task to
reschedule it; cancellation records no completed history. Unsaved forms offer
Save and leave, Discard and leave, or Stay. Failed requests keep the draft.

### Work to do

New tasks generate an editable recap and checklist from the selected saved garden
or bed. Planting steps use saved row counts and broadcast seed quantities; mulch
steps retain material layer order and the existing plant clearance. Care and
harvest steps ask you to check what is needed or ready. The generator describes
the saved plan; review which work is actually needed before saving.

Edit the recap and instructions, add/remove items and check progress. Save task
persists these changes together. An unchanged generated list follows scope and
activity changes; manual edits and checked progress are preserved for review.
Generate from saved plan reads the latest saved plan. Replacing edited
instructions requires an explicit confirmation. Regeneration resets the new
suggestion’s checks. Existing tasks retain their instructions until you regenerate
them; changes to the garden or catalogue never silently rewrite the list.

The agenda shows Work to do with checked/total progress. Edit task updates it;
Record completion reviews it read-only alongside the actual completion date and
saved-plan confirmation. Checking every item does not complete the task, and
recording completion does not silently tick unchecked items. Linked history
correction/deletion preserves the task’s reviewed instructions.

Migration 035 adds recap/checklist storage and an atomic, revision-checked save
endpoint. It is applied and verified on live Supabase as of 24 November 2026.
Refresh Calendar to reload checklist availability. Before rollout, title/notes
planning and completed history remain available. Existing tasks
receive empty work fields; there is no automatic data backfill from today’s plan.

After doing the work, update the garden/bed to match reality and let it save.
Choose the task’s **Record completion**, review its latest saved scope, enter the
actual date and completion notes, and confirm that the saved plan matches the
result. One transaction captures the saved garden or bed through the existing
history recorder and marks the task completed. Other current bed proposals are
not confirmed by a bed task. Revisions and retry IDs prevent stale or duplicate
completion; conflicts require an explicit reload and a new confirmation.

Each linked completion appears once in Work. Corrected history dates, titles and
notes are reflected there. Deleting history retains the completed task with a
removed-record message. **Open history** uses the existing read-only inspector,
correction and deletion tools without selecting another editable garden or
replacing the mounted editor draft. Back preserves Work filters.

**Seasonal guidance** keeps the current garden’s regional monthly/annual advice
separate from dated work. **Plan an activity** prefills a task title; review its
date and scope, then Save task. Merely browsing guidance creates nothing.

## Calendar in the editors

Calendar opens beside the drawing on desktop and below it on phones. It takes
space in the regular editor layout, without covering the canvas. Selecting another
bed tool switches away from Calendar; only the active tool is highlighted. The garden
includes all beds; a bed includes its own records and garden-wide checkpoints.
The panel uses the same month grid, status filters and agenda as the full Work
calendar, with its garden context fixed. A dedicated command row groups Plan
activity, Filters, Refresh and Open full calendar. Filters expand below it.
Activities shows a readable date range and count; each task separates edit/complete
actions from cancellation options. Recording completed work and selected-record
corrections/deletion have their own sections.

Select a day to preview the last completed state on or before it. The agenda
lists that day’s activities; View record selects an exact checkpoint, including
multiple records on one day. Whole month and All dates broaden the agenda.
Month arrows browse months only; record navigation arrows have been removed.
Planned tasks open their details while leaving the drawing unchanged.

Return to current plan restores editing while keeping the panel open. Close
calendar restores editing and the previous controls. The bed editor remains
mounted through previews, retaining incomplete fields, selection and undo state.
Open full calendar retains this editor context; Back returns to it. Historical
corrections still use explicit historical drafts, without changing today’s plan.

Completed history loads through existing metadata if dated-task storage is
missing. Dated planning is disabled with a clear message; history selection,
recording, correction and deletion remain available. Migration 034 was applied and verified on live Supabase after explicit approval
on 24 November 2026. Refresh Calendar to reload its storage availability.

## Bed history and area editing

The bed toolbar's **Calendar** shows garden checkpoints and that bed's
completed records in the shared month grid and agenda. Saved formats retain
their geometry. **Focus area** enlarges a historical area read-only. Backdated
edits, corrections and deletion are described in [history](history.md).

Select an area and choose **Focus area**, or double-click it on desktop, to zoom
within the bed page. Wheel and pinch zoom follow the pointer or fingers. Enable
**Pan** to drag the view; **Fit bed** restores the whole bed. Areas stay editable
and neighbours remain visible. Zoom and pan do not save or change undo history.
The camera stays stable through selection, edits and resize previews.

Settings appear beside the drawing on desktop and overlay it on phones.
**Edit selected area** opens phone controls; **Hide controls** reveals the canvas.
**Advice** opens Suggestions separately from editable Areas and bed Settings.
The 5 cm grid, distance guides, clearances and bed-relative cm coordinates remain
unchanged. Autosave and invalid-draft protection apply throughout.

## Storage

Existing editor history works through migration 033. Migration
`202611240034_dated_garden_tasks.sql` enables dated tasks and is applied and
verified on live Supabase as of 24 November 2026.
The garden document is the only active planning document. Legacy open-work
storage remains retained in the database but is inaccessible through the retired
browser endpoints; pending copies are never merged into the plan automatically.
The completed-only RPC captures a checkpoint atomically, without applying another
bed snapshot. Owner/editor authorization, saved revisions and physical-scene
validation remain enforced. Outsiders, revoked users and anonymous users cannot
record history. Tests use isolated databases, not live user records.

Migration 034 adds `garden_tasks`, an RLS-protected metadata table, and the
security-invoker `garden_work_events` metadata view. Authenticated owners and
shared editors use `save_garden_task` and `complete_garden_task`; direct writes
are denied. Completion locks the garden and task, checks both reviewed revisions,
and links the existing history record atomically. Garden deletion cascades tasks.
Legacy pending copies remain hidden; migration 034 does not import them or alter
current gardens or existing history. Work reads both datasets with independent
cursor pagination. Dates stay date-only; recorded timestamps remain separate.

Migration 035 adds `work_recap` (up to 4,000 characters) and `work_items` (up to
100 unique items with 500-character instructions and checked state). The new
`save_garden_task_work` RPC validates and saves these with existing task metadata,
using garden authorization, expected task revisions and payload-aware retry IDs.
Direct table writes remain denied. The existing save/completion RPCs preserve the
new fields, allowing older clients to keep working. Before migration 035, reads
fall back to the existing task columns and checklist editing is unavailable.
