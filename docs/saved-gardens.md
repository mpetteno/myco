# Saved gardens

## Database setup

Apply the files in `supabase/migrations/` once, in filename order, to the Supabase
project used by `.env`: first `202611160001_saved_gardens.sql`, then
`202611160002_garden_sharing.sql`. Run each complete file in the Supabase SQL Editor or
through the connected IDE database source using a database administrator account.
The public browser key cannot apply migrations. Never put administrator
credentials in a `VITE_` environment variable.

Each migration runs in a transaction. The first creates a new `public.gardens` table,
validation and versioning functions, a trigger, an index and owner-only policies.
The second adds garden membership, sharing functions and member access policies.
Neither modifies existing auth users. If these objects already exist, stop and
inspect the database rather than replacing them. Neither file is intended to be
rerun after a successful application. This repository does not automatically
apply SQL when the frontend starts.

## Using gardens

After signing in, create a garden with a name, width and length in centimetres.
It starts with no beds. Tap the current garden name in the header to choose an
existing garden or create another. **More → Rename garden** changes its name.
Duplicate names are allowed; gardens have independent IDs and layouts.

Names, dimensions, bed additions, deletions and finished move/resize gestures
save automatically. Pointer previews remain local until the gesture ends.
A green dot in the header means saved; amber means pending or failed. Failed
saves also show a message and a retry action. Switching gardens and signing out
wait for saves to finish and stay on the current garden if saving fails.
Reloading loads the most recently updated garden. Selection and the copied-bed
buffer remain temporary and reset when switching gardens.

## Storage and access rules

Each garden row stores `owner_id`, name, `width_cm`, `length_cm`, beds as JSONB,
version and timestamps. Bed fields keep the editor's centimetre model:
`id`, `name`, `xCm`, `yCm`, `widthCm`, `lengthCm`.
Dimensions and beds save together to avoid partial layout updates.

Both the client and PostgreSQL validate the 5 cm grid, positive dimensions,
garden boundaries, unique bed IDs and absence of overlaps. Row Level Security
allows signed-in users to create their own gardens and read/update gardens they
own or that have been shared with them. Anonymous access, owner/identity changes
and client-supplied revisions are denied. Garden deletion is not implemented.
See [sharing](sharing.md) for membership and owner-only access management.

Updates match the last saved version. PostgreSQL increments it atomically.
If another session has updated the same garden, the app retains local edits
and offers **Discard changes and reload saved garden**. It does not merge layouts
or overwrite a newer saved version. Within one editor, writes are serialized and
pending snapshots coalesce to the newest layout.

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
