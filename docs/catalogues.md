# Plant catalogues

## Using the catalogue

Open **More → Plant catalogue** in a garden. The empty garden workspace also has
a **Plant catalogue** button. These are panels on the existing single page and
use the same mobile, safe-area and dark-mode layout as the editor.

There is one catalogue for the whole app. All signed-in users may browse and
search its families, plant types and companion rules. Administrators may add and
edit entries. Garden ownership or editor access does not grant this role.
The catalogue starts empty; it contains no preset horticultural advice.

Families have a name, notes and optional default distances between plants in a
row and between rows. Plant types belong to a family and may override either
distance independently. Empty plant-type distances inherit the corresponding
family default. If both are empty, that recommendation is unknown. Distances
are positive centimetres and may be fractional. Reference distances are retained
exactly; this does not change the garden's existing 5 cm drawing grid.

Plant types also define a **Minimum border distance** in cm, initially 15 cm.
It must be at least 5 cm in steps of 5 cm and does not inherit from the family.
The planner centres rows and plants while respecting this minimum; rows move
closer only when necessary. Plant references capture the border distance, so
editing the catalogue does not rewrite saved plans or history.

Companion rules connect any pair of families or plant types. They can record a
companion suggestion or a caution, with optional explanatory notes. The same
pair applies in both directions, so reversed duplicates are rejected. Rules
between the same family are also supported. Missing rules mean unknown.

Specificity determines advice: plant/plant rules take priority over plant/family
rules, which take priority over family/family rules. When equally specific rules
disagree, caution takes priority and both rules remain available for explanation.

Each edit uses its loaded version. A stale save or revoked administrator role
shows an error and keeps the form open. Return to the catalogue and refresh to
load the latest entries. This step provides creation and editing, with no hard
deletion. Stable IDs are retained for future planting and history references.

## Database and administrators

Apply `supabase/migrations/202611160003_plant_catalogues.sql` once, after the garden
and sharing migrations. It creates `plant_families`, `plant_types`,
`companion_rules` and `catalogue_administrators`, with Row Level Security,
reference constraints, duplicate protection and version triggers. After subsequent
migrations, apply `202611160014_plant_border_distance.sql` for the border property,
admin-only column writes and matching saved-plan validation. Existing plant
types default to 15 cm, and older plan snapshots retain their implicit minimum.

Administrator membership is managed through a trusted database connection or
the Supabase SQL Editor. The browser cannot grant or revoke it, even for an
existing catalogue administrator. To add another confirmed account, replace the
example email and run:

```sql
INSERT INTO public.catalogue_administrators (user_id)
SELECT id
FROM auth.users
WHERE lower(email) = lower('new-admin@example.com')
  AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id) DO NOTHING
RETURNING user_id;
```

Check that the intended account exists if no row is returned. To revoke a role,
use the same trusted database connection to delete that account's membership.
Revocation affects its next write; it can still browse as a signed-in user.
No secret key or role is stored in the frontend, auth metadata or local storage.

## Planting guidance

The catalogue stores reference guidance. [Bed planting plans](planting.md) retain
the spacing and guidance used when applied, so catalogue edits do not silently
rewrite existing plans. Planning exceptions belong to the plan and may override
recommendations without editing this shared catalogue. Dated activities remain
separate work; [layout history](history.md) retains these plans in saved events.

Agreed defaults:

- Use the larger spacing requirement between different plant types and adjacent rows.
- Centre rows at the chosen spacing, maximising balanced border gaps with a 15 cm minimum. Compress row spacing only when needed to keep that minimum.
- Choose row direction independently per area, defaulting to the bed's longest dimension.
- Start new areas with 2 rows; allow a different explicit count or automatic spacing.
- Present companion suggestions and warnings with a way to proceed despite guidance.
- Store plant points relative to their bed and distinguish planned from actual dates.
- Support different mulch areas and ordered layers of different materials.
- Leave a 5 cm radius of uncovered soil around active plant points in each mulch layer.

The catalogue helpers resolve family defaults, symmetric companion advice and
the larger spacing recommendation. The planner provides row previews, counts,
planting areas and explicit spacing overrides. [Dated activities](activities.md)
distinguish planned work from completed bed checkpoints. Garden snapshots are
available in [layout history](history.md). The
[mulch catalogue](mulch.md) now defines reusable materials with the same
administrator role. Bed plans now support independent mulch areas and ordered
layers, with 5 cm clearances around plants.

## Verification

`npm test` covers the real migrations in isolated PostgreSQL, administrator role
provisioning/revocation, authenticated browsing, denied anonymous/non-admin writes,
role self-promotion prevention, foreign keys, duplicate pairs, revision conflicts,
spacing inheritance, companion precedence and Supabase repository requests.
Tests create no live users and populate no live catalogue data.

For browser review, open the catalogue as an administrator, add two families and
plant types, set defaults and overrides, and add a companion or caution rule.
Open it in an ordinary account to verify browsing without editing controls.
