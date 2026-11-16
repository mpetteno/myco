# Mulch

Open **More → Mulch catalogue** from a garden, or **Mulch catalogue** in the
workspace before creating a garden. The panel uses the existing phone, safe-area
and dark-mode layout.

There is one app-wide catalogue. Signed-in users can browse and search names
and notes. The same administrators who manage the plant catalogue can add and
edit mulch types. Garden ownership and sharing do not grant catalogue editing.
The catalogue starts empty.

Each type has a name (1–100 characters), optional notes (up to 2,000 characters),
a stable ID and a revision. Names must be unique regardless of case or surrounding
spaces. Edits check the loaded revision. A conflicting edit, network failure or
revoked administrator role keeps the form open with its entered values. Return
to the catalogue and refresh to load the current entries and permissions.

Apply `supabase/migrations/202611160009_mulch_catalogue.sql` once after the earlier
migrations. It creates `public.mulch_types` with Row Level Security, restricted
write columns, duplicate protection and the existing catalogue version trigger.
No new administrator role or secret frontend key is required. Administrator
provisioning is documented in [catalogue setup](catalogues.md).

Types cannot be hard-deleted through the app, so their IDs can support saved
plans and future history references.

## Areas and layers in a bed

Open a bed and choose **Mulch** in its toolbar, then **Add mulch area**. The first
rectangle fills the bed, independently of any planting areas. Name it, move it,
or drag its edge/corner handles with mouse or touch. Rectangles snap to 5 cm,
stay within the bed and cannot overlap other mulch rectangles. Resize the first
one to make space before adding another. Planting and mulch areas may overlap.

Each area has one or more layers. Choose a catalogue type for each layer and use
**Add layer on top**, **Lower**, **Higher** and **Remove** to manage the stack.
The list runs from bottom to top; the final layer is the visible surface.
**Preview layer** shows an individual layer in the selected area without changing
the stack. **Show top layers** restores the normal view. Planting tools and the
garden drawing always show the top layers. Layers may repeat the same material.

Every layer automatically excludes a circle of **5 cm radius** around every
plant point in the bed, including circles that intersect a mulch area's edge.
Clearance follows the current planting preview while editing, and the saved
planting plan in the garden view. It uses real cm, independent of display zoom
or orientation. Overlapping circles stay uncovered. Mulch uses an isolated
canvas surface so clearing the circles reveals soil without erasing the grid,
plants or other beds. Lower layers have the same clearance and cannot show
through a top-layer hole.

Valid planting and mulch edits autosave atomically through the existing garden
save queue in Plan mode. Back waits for saves; invalid fields need correction
or discarding. Expanding a mulch rectangle shrinks touched mulch neighbours
horizontally and vertically, preserving their materials and layers. Neighbours
keep at least 5 cm per dimension; the resize stops before an area disappears.
Planting areas are independent and never shrink when editing mulch. A bed can contain mulch without any plants. Removing the
last mulch area clears its saved mulch while preserving planting; clearing
planting preserves mulch. Bed size changes cannot crop saved or draft mulch.
Copying a bed deep-copies materials and gives its areas/layers new IDs.

Apply `supabase/migrations/202611160010_bed_mulch_plans.sql` after the catalogue
migration. It adds validation and a garden check constraint; existing gardens
remain valid and no stored layouts are rewritten. Garden owners and shared
editors can change mulch plans without being catalogue administrators.

`Bed.mulchPlan` stores format version 1 and up to 12 named rectangles, each with
up to 8 layers in bottom-to-top order. Each layer captures the material's ID,
name, notes and catalogue revision. Catalogue edits do not rewrite applied
layers; choosing a type again adopts its current reference. Display previews
and clearance circles are derived rather than stored. Client and database
validation enforce bounds, grid, non-overlap, unique area/layer IDs and bounded
snapshot contents. [Layout history](history.md) retains these plans in explicit
dated garden snapshots. [Mulch activities](activities.md) distinguish planned
dates from actual completion checkpoints. Thickness and individual layer-level
activity records remain future steps.

`npm test` checks the real migration in isolated PostgreSQL, reader/admin/anonymous
permissions, administrator revocation, duplicate names, revision conflicts and
protected metadata. Repository tests check Supabase requests and errors. React
DOM tests cover search, creation, editing, failed saves and refresh after access
changes. Plan tests cover shared atomic saves, stale writes, malformed snapshots,
grid/bounds, layer order, copies, clearance drawing commands, independent mulch
and planting, autosave and invalid-field discard behaviour. They do not verify native device
layout or browser pixel rendering. Tests create no live catalogue records or users.
