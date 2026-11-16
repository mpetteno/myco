# Garden and bed history

The current garden plan autosaves. Completed history is recorded explicitly.
**History → Record garden changes** captures the whole implemented garden plan;
**Record bed changes** confirms a selected bed. Date/title/notes are
separate from the server's recording timestamp. Planning edits alone never
create a completed event. Form headings and confirmation buttons use the same
**Record garden changes** / **Record bed changes** labels. These flows use the
shared [localization catalogue](localization.md).

## Add a backdated edit

In garden **History**, select a calendar date and choose **Add past garden edit**.
This opens an independent historical draft with the normal garden and bed tools.
Move/resize/add/delete beds, change garden dimensions or names, and open beds to
edit planting areas and mulch. The permanent top bar identifies the historical
draft. Choose **Save history record**, review the date, title and notes, then
**Save record**.

Inside a bed's **History**, choose **Add past bed edit**. It opens that bed's
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

The calendar marks completed records in green. Previous and next arrows visit
individual events, including multiple records on one day. Calendar selection
shows the last completed state on or before that day. Bed history includes
its own records and garden layout records.

Browsing snapshots is read-only. Editing requires opening a separate historical
draft. **Plan** returns to the autosaved current layout; **Close history** also
hides navigation. Dates do not shift with timezone conversion. Recording times
use the device's locale. Historical snapshots never replace the current plan.

## Delete an entry

Select an event in garden or bed History and choose **Delete history entry**.
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

Apply migrations in order through `202611170017_record_bed_changes.sql`. Migration 015 adds record revisions,
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
