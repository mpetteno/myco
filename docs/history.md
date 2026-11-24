# Garden and bed history

The current garden plan autosaves. Completed history is recorded explicitly.
**Calendar → Record garden changes** captures the whole implemented garden plan;
**Record bed changes** confirms a selected bed. Date/title/notes are
separate from the server's recording timestamp. Planning edits alone never
create a completed event. Form headings and confirmation buttons use the same
**Record garden changes** / **Record bed changes** labels. These flows use the
shared [localization catalogue](localization.md).

## Add a backdated edit

In garden **Calendar**, select a calendar date and choose **Add past garden edit**.
This opens an independent historical draft with the normal garden and bed tools.
Move/resize/add/delete beds, change garden dimensions or names, and open beds to
edit planting areas and mulch. The permanent top bar identifies the historical
draft. Choose **Save history record**, review the date, title and notes, then
**Save record**.

Inside a bed's **Calendar**, choose **Add past bed edit**. It opens that bed's
historical editor. Planting, mulch, name and size changes update the draft.
**Back to garden** lets you move or resize that bed in its historical context;
other beds are protected. A new bed record merges only its target into the
recorded state on the chosen date. Unrelated current proposals are excluded.

Drafts start from the last completed state on or before the selected date. If
there is no earlier record, a garden draft uses the current plan as an explicit
editable template, retaining bed IDs. A bed draft starts from that current bed
only. The record form describes its starting point. Review the contents to match
what actually existed. Browsing dates before the first record still shows no
known state; opening a draft does not invent a completed event.

The date field moves the draft's contents to that date; it does not rebase your
edits automatically. Select the intended calendar date before starting when you
want its recorded layout as the editing base.

## Correct an existing record

Select a completed event and choose **Edit history record**. Modify its layout
or bed contents, then save its date, title and notes. Garden records allow the
whole garden to change. Bed/planting/mulch records allow their target bed to
change while retaining their original scope. A correction retains the event ID,
original recording time and author, increments its revision, and stores the
previous record in a protected revision table. Corrected entries are labelled.
Completion dates, titles and notes stay synchronized for linked bed activities.

**Inserting or correcting an old record leaves every other saved record's
state and the current plan unchanged.** The corrected/new state appears from its
date until the next explicit record. Later records keep the states that were
recorded for them, including bed checkpoints. Historical changes never apply
the edited bed to today's plan.

Historical drafts update locally while editing and are recorded only through
**Save record**. They are held in memory until then: leaving or reloading warns
about unrecorded changes. Invalid planting fields must be fixed before saving.
Failed requests keep the draft and form; retries reuse their request identity.
Concurrent corrections fail rather than overwrite another editor. **Reload
record and discard draft** explicitly loads that record's latest revision.
The single current plan continues to autosave independently.

## Navigation

Both editors open the shared Calendar panel on the right, or below the drawing
on phones. It participates in the editor layout instead of overlaying the canvas. The garden includes all bed records; a bed includes its own records
and garden-wide checkpoints. Completed records are green. Select a date to
preview the latest recorded state on or before it, then choose an individual
record in that day’s agenda. Same-day records remain separately selectable.
Whole month and All dates broaden the list. Month arrows navigate months; record
previous/next controls have been removed.

Browsing snapshots is read-only. Editing requires a separate historical draft.
Return to current plan restores the editable layout while keeping Calendar open;
Close calendar also closes the panel. The mounted bed draft, incomplete fields,
selection and undo state remain intact. Planned tasks open their details without
changing the drawing. Open full calendar provides cross-garden Work browsing and
Seasonal guidance; Back restores the original editor context.

Dates stay date-only, independently of recording timestamps. Selecting a date
before the first checkpoint shows no known historical state. A preview never
replaces the current plan. Completed history remains available when dated-task storage is missing.
Migration 034 is applied and verified on live Supabase as of 24 November 2026;
dated planning is available after refreshing Calendar.

## Delete an entry

Select an event in garden or bed Calendar and choose **Delete history entry**.
Review its title/date and confirm **Delete entry**. Cancellation leaves it intact.
Deletion removes just that event from the timeline and calendar. Earlier states
are shown until the next remaining checkpoint; later records retain their frozen
snapshots and the current plan stays unchanged. Deleting the last/only record
can leave a date with no known history. Linked activities remain completed.

Owners and shared editors can delete, with the same permissions as correcting
history. A concurrent correction rejects deletion until you reload/select the
latest record. Failed requests retain the confirmation and its retry identity.
Deleted entries and prior values remain in the database for audit/recovery;
there is no restore interface yet. No other event is recalculated.

## Storage and access

Editor history remains available through migration 033. Migration 034 enables
dated tasks and is applied and verified on live Supabase (24 November 2026). Migration 015 adds record revisions,
protected correction copies and `display_snapshot`. Existing bed scenes are
materialized using the previous reconstruction rules without changing the
original captured proposals or working gardens. New ordinary completion records
also capture their displayed state. Later states are therefore independent of
backdated insertions and earlier corrections.

`save_garden_history_event` locks the garden for authorization, checks
owner/editor membership and the expected event revision, validates names,
dimensions, overlaps, planting and mulch, and inserts or corrects one record.
Request IDs make committed retries idempotent. The RPC does not update gardens.
The browser cannot write events or revision copies directly. Outsiders, revoked
editors and anonymous users are denied. Previous versions retain their catalogue
snapshots and geometry formats.

Future bed completions are rejected if their merged physical scene would overlap
another recorded bed or otherwise become invalid. Record/correct the actual
garden layout before completing that bed activity; failure rolls the completion
back instead of creating an uneditable invalid snapshot.

Tests cover real migrations, preservation of later states and current gardens,
revision copies, linked activity metadata, permissions, conflicts, retries,
scoped edits, failed/dismissed drafts, late responses, backdating, existing
history navigation, and public RPC payloads. Browser canvas pixels and native
Android/iOS checks remain manual. Tests create no live users or history events.

Migration 016 retires the separate open-work endpoints and adds the completed-only
`record_completed_bed_activity` RPC. Existing pending rows are retained as legacy
data, hidden from the app and never applied automatically. History deletion uses
`delete_garden_history_event`, expected revisions and retry IDs, retaining a
recovery copy in `garden_layout_event_revisions`. Queries and new bed-record
bases exclude deleted entries. Deleted IDs cannot be resurrected by old saves
or completion retries. Direct browser mutations remain denied.

Migration 017 adds `record_bed_changes`: new bed checkpoints use the general
`bed` category and capture both planting and mulch from the saved plan. Earlier
planting/mulch labels are preserved on existing records.

## Combined Work calendar

Editor **Calendar → Open full calendar → Work** combines planned tasks with this completed
history. Task completion is an explicit, revision-checked transaction capturing
the current saved garden or bed through the same recorders. It does not apply a
proposed snapshot. **Open history** opens this inspector independently of the
mounted editable garden. Its canvas stays read-only even when viewing Current
plan; historical editing still requires a separate draft.

A completion linked to a task appears once in Work. Corrections use the current
history metadata. Soft deletion hides its history action but keeps the task
completed, labelled as a removed linked record. Standalone deleted history is
omitted. Seasonal guidance remains a separate Calendar view; see
[dated tasks](activities.md).

Planned work can retain a reviewed recap and Work to do checklist (migration 035,
applied and verified on live Supabase, 24 November 2026). Checklist progress stays on the task, separate
from explicit completion. Existing completion still captures the latest saved
plan; it preserves the recap and every item’s checked state. Correcting or deleting
linked history leaves these task instructions intact. The calendar groups
selected-record corrections/deletion separately from recording new completed work.
