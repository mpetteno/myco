# Saved gardens

## Database setup

Apply the files in `supabase/migrations/` once, in filename order, to the Supabase
project used by `.env`: `202611160001_saved_gardens.sql`,
`202611160002_garden_sharing.sql`, `202611160003_plant_catalogues.sql`, then
`202611160004_bed_planting_plans.sql`, `202611160005_area_rows.sql`, then
`202611160006_spacing_margins.sql`, `202611160007_fixed_area_margins.sql`, then
`202611160008_balanced_area_rows.sql`, `202611160009_mulch_catalogue.sql`, then
`202611160010_bed_mulch_plans.sql`, `202611160011_garden_layout_history.sql`, then
`202611160012_bed_activities.sql`, `202611160013_open_work_plans.sql`, then
`202611160014_plant_border_distance.sql`, `202611160015_editable_history.sql`,
`202611170016_single_plan_history_deletion.sql`, and
`202611170017_record_bed_changes.sql`. Apply the subsequent catalogue/area migrations
in order, then `202611240032_delete_garden.sql` for garden deletion.
`202611240033_area_minimum_clearances.sql` adds per-edge row-area validation;
it can be applied independently of 032 after the preceding area migrations.
Neither migration automatically runs with the frontend.
Run each complete file in the Supabase SQL Editor or
through the connected IDE database source using a database administrator account.
The public browser key cannot apply migrations. Never put administrator
credentials in a `VITE_` environment variable.

Each migration runs in a transaction. The first creates a new `public.gardens` table,
validation and versioning functions, a trigger, an index and owner-only policies.
The second adds garden membership, sharing functions and member access policies.
The third adds the app-wide [plant catalogues](catalogues.md) and administrator roles.
The fourth validates optional [bed planting plans](planting.md) within the garden snapshot.
The fifth supports per-area row counts and directions with 15 cm bed clearance,
while keeping existing version-1 plans valid.
The sixth adds spacing-based, area-relative margins while retaining version-1
and version-2 saved layouts.
The seventh adds fixed 20 cm area margins for new plans, retaining all older layouts.
The eighth centres chosen rows at their preferred spacing with 15 cm minimum
area margins, retaining all older layouts until reapplied.
The ninth adds the app-wide [mulch catalogue](mulch.md), using the existing catalogue administrator role.
The tenth validates optional bed mulch areas and ordered material layers within
the same atomic garden snapshot and sharing rules.
The eleventh adds explicit dated [layout history events](history.md), with
immutable snapshots and owner/editor access. It does not create automatic events
from existing gardens or autosaves.
The twelfth adds revision-checked [planting and mulch activities](activities.md)
and completed bed checkpoints, preserving existing layout snapshot content.
The thirteenth adds optional work dates, independent editable beds and atomic
application of completed work.
None modifies existing auth users. If these objects already exist, stop and
inspect the database rather than replacing them. These files are not intended to be
rerun after a successful application. This repository does not automatically
apply SQL when the frontend starts.

## Using gardens

After signing in, create a garden with a name, width and length in centimetres.
It starts with no beds. Tap the current garden name in the header to choose an
existing garden or create another. **Garden settings → Rename garden** changes its name.
Duplicate names are allowed; gardens have independent IDs and layouts.

Names, dimensions, bed additions, deletions and finished move/resize gestures
save automatically. Pointer previews remain local until the gesture ends.
**Saving…** appears separately from the garden selector only while saving. Failed
saves show a message and a retry action. Switching gardens and signing out
wait for saves to finish and stay on the current garden if saving fails.
Reloading loads the most recently updated garden. Selection and the copied-bed
buffer remain temporary and reset when switching gardens.

## Storage and access rules

Each garden row stores `owner_id`, name, `width_cm`, `length_cm`, beds as JSONB,
version and timestamps. Bed fields keep the editor's centimetre model:
`id`, `name`, `xCm`, `yCm`, `widthCm`, `lengthCm`.
Each bed may also include a `plantingPlan` with relative planting areas and
snapshots of catalogue recommendations and plan-specific spacing choices.
Dimensions and beds save together to avoid partial layout updates.

Both the client and PostgreSQL validate the 5 cm grid, positive dimensions,
garden boundaries, unique bed IDs and absence of overlaps. Row Level Security
allows signed-in users to create their own gardens and read/update gardens they
own or that have been shared with them. Anonymous access, owner/identity changes
and client-supplied revisions are denied. **More → Delete garden** is owner-only
and requires confirmation. The operation waits for pending saves and checks the
latest garden revision under a row lock. A stale revision requires reloading;
failed requests retain the dialog for retry. Successful deletion clears the active
editor and calendar, then offers remaining gardens or creation.
Deletion permanently cascades to sharing, history, activities and their revisions.
It cannot be undone. Only `delete_garden(uuid, bigint)` permits deletion; direct
table DELETE remains denied. An already-deleted garden is a safe successful retry.
See [sharing](sharing.md) for membership and owner-only access management.

Updates match the last saved version. PostgreSQL increments it atomically.
If another session has updated the same garden, the app retains local edits
and offers **Discard changes and reload saved garden**. It does not merge layouts
or overwrite a newer saved version. Within one editor, writes are serialized and
pending snapshots coalesce to the newest layout.
These revisions protect concurrent edits; they do not represent diary events.
Use **History → Record garden changes** to record a dated snapshot explicitly.

This is online storage. Failed edits remain in memory for retry, not in an
offline cache. Keep the app open until saves complete. A browser may warn about
pending changes on close, but abrupt app termination or mobile suspension can
still lose unsaved changes. Offline sync needs separate work.

## Verification

`npm test` runs isolated authentication and storage tests, including the actual
migration in an in-memory PostgreSQL instance through PGlite. These cover
cross-user access, invalid layouts, stale versions, autosave ordering and retry,
and repository requests using the real Supabase JavaScript client with mocked
HTTP. No tests create live Supabase users or send email.

After applying the migration, verify with real accounts: create two gardens,
add and move beds, rename a garden, switch between them, then reload and sign
out/in. Use a second account to confirm it starts with an empty garden list.
Desktop browser and Android/iOS visual checks remain separate from these tests.
