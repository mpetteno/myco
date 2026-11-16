# Garden sharing

Apply `supabase/migrations/202611160002_garden_sharing.sql` after the saved-garden
migration. See [database setup](saved-gardens.md). Each migration is applied once.

## Using sharing

Open a garden and choose **More → Sharing**. The owner can enter another user's
email to grant editing access immediately. The account must already exist and
its email must be confirmed. Email matching ignores case and surrounding spaces.
Adding an existing editor again has no effect. The owner always retains access.
This flow sends no email and does not create pending signup invitations.

The panel lists editors by their current account email. **Remove** revokes that
user's access. Editors can see an explanation of their permissions, but cannot
view or change the sharing roster. Everyone with access can edit the garden's
name, dimensions and beds. Only the owner can add or remove editors.

Recipients can open the garden picker to see gardens marked **Shared · Can edit**.
The picker refreshes on opening and has a **Refresh gardens** action. The initial
empty workspace also offers refresh to discover a newly shared garden.

Other people's edits load when reopening the garden. Editing is not a live
collaborative session: existing version checks reject a stale save instead of
overwriting someone else's changes. After access is revoked, an already-open
editor can retain its local drawing, but database reads and writes are denied.
The save error offers **Discard changes and reload gardens** to return to the
gardens still available to that user.

## Access implementation

`public.garden_members` stores `(garden_id, user_id)` with a unique primary key
and cascading foreign keys. Users may read only their own membership records.
There are no client mutation grants on this table. Garden read/update policies
allow either ownership or an existing membership, while ownership, identity and
version columns retain their original write restrictions.

Three authenticated database functions handle access:

- `share_garden(p_garden_id, p_email)` resolves an exact confirmed email and adds an editor.
- `list_garden_members(p_garden_id)` returns editor IDs and emails for the owner.
- `unshare_garden(p_garden_id, p_user_id)` removes an editor.

Each checks the caller's ownership before accessing users or memberships. They
use `SECURITY DEFINER` with an empty search path and fully qualified relations
to keep the auth directory private and prevent direct client membership writes.
Sharing changes lock the garden row to serialize mutations. They do not change
the layout's saved version. Anonymous callers cannot execute these functions.

See the Supabase documentation on [database function security](https://supabase.com/docs/guides/database/functions)
and [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Verification

`npm test` applies both migrations in isolated PostgreSQL and tests owner sharing,
duplicate additions, confirmed-email lookup, editor layout changes, stale saves,
denied sharing operations, direct membership mutation, private user data,
anonymous/outsider access, and immediate revocation. Repository tests exercise the
real Supabase client with mocked HTTP. No live users or email are created.

For browser review, sign in with two existing accounts. Share from the owner,
refresh the second account's garden list, edit the shared garden, reopen it as
the owner, then remove the editor and check that their next save is rejected.
