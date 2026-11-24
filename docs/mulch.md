# Mulch

Open **Your gardens → Catalogue**, then select **Mulch materials**. The empty
workspace also has a **Catalogue** button. Plants, calendars, materials and
categories share this dedicated page with phone, safe-area and dark-mode support.

There is one app-wide catalogue. Signed-in users can browse and search names
and notes. The same administrators who manage the plant catalogue can add and
edit mulch types. Garden ownership and sharing do not grant catalogue editing.
Migration `202611240030_mulch_materials_and_depth_notes.sql` supplies seven organic materials (leaves, fieno, paglia, sfalci d’erba, cartone, corteccia, compost) and synthetic telo sintetico.

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

After migration `202611170020_catalogue_removal.sql`, administrators can remove a
type using **Remove** and a confirmation. The operation checks administrator
membership and the loaded revision. Existing plans, activities and history keep
their saved material references; direct table deletion remains denied to clients.

## Layers attached to an area

Open a bed, choose **Areas**, select an area, and use **Add mulch layer** in its
settings or focused area editor. Plant rows and broadcast sowing areas
can all have zero to eight layers. There is no separate mulch area or toolbar.
Layers share the area's position and dimensions and move/resize with it.

Choose a catalogue material for each layer. **Lower**, **Higher** and **Remove**
manage the stack from bottom to top. The final layer is the visible surface.
Removing the last layer leaves the same area without mulch. Materials may repeat.

Every layer automatically excludes a circle of **5 cm radius** around every
plant point in the bed, including circles that intersect a mulch area's edge.
Clearance follows the current planting preview while editing, and the saved
planting plan in the garden view. It uses real cm, independent of display zoom
or orientation. Overlapping circles stay uncovered. Mulch uses an isolated
canvas surface so clearing the circles reveals soil without erasing the grid,
plants or other beds. Lower layers have the same clearance and cannot show
through a top-layer hole.

Valid area edits autosave atomically through the existing garden save queue.
Back waits for saves; invalid fields need correction or discarding. Neighbour
resizing respects all area kinds and the clearances/rows of row plantings.
Changing an area's planting method keeps its dimensions, purpose and layers.
Deleting an area removes its attached layers. Copying a bed gives areas and
layers new IDs and deep-copies their catalogue snapshots.

Migration `202611170021_unified_areas_seed_mixtures.sql` introduces `Bed.areaPlan`.
The legacy `Bed.mulchPlan` format and renderer remain available for older history.
New plans store material snapshots in each area's `mulch` array. Client and
database validation enforce bounds, grid, non-overlap, unique IDs and bounded
snapshots. See [Unified areas](areas.md) for the full model and migration details.

`npm test` checks the real migration in isolated PostgreSQL, reader/admin/anonymous
permissions, administrator revocation, duplicate names, revision conflicts and
protected metadata. Repository tests check Supabase requests and errors. React
DOM tests cover search, creation, editing, failed saves and refresh after access
changes. Plan tests cover shared atomic saves, stale writes, malformed snapshots,
grid/bounds, layer order, copies, clearance drawing commands, area attachments
and planting, autosave and invalid-field discard behaviour. They do not verify native device
layout or browser pixel rendering. Tests create no live catalogue records or users.

## Categories and living mulch

After migration `202611170018_catalogue_guidance.sql`, materials belong to organic,
synthetic or living categories. Existing materials may remain unclassified until
an administrator edits them. Categories can be managed by selecting **Mulch categories** on the catalogue
page. Only catalogue administrators can manage either materials or
categories; all signed-in users can browse and use eligible materials.

Living materials are generated from the plant catalogue, with no Add/Edit/Remove controls here. They reference a crop and optionally its cultivar. A crop must have
**Can be used as living mulch** enabled, or the selected cultivar must explicitly
enable it. Cultivars otherwise inherit eligibility from their crop. Other material
categories cannot reference plants; cultivar references must belong to their crop.

Disabling plant eligibility prevents newly applying that material. Existing layers
and historical snapshots remain valid. The client filters unavailable materials,
and the database independently checks newly applied layers during garden saves.
A living layer is a material reference, without generated planting points or tasks.


## Starter materials and depth-note cleanup — 24 November 2026

Apply `202611240030_mulch_materials_and_depth_notes.sql` after earlier migrations. It adds only missing material names, preserves administrator edits, and backs up exact numeric depth-note duplicates before clearing them. It also validates flag-derived living layer IDs against the current catalogue in both unified and legacy plans. Existing saved layers and history retain their snapshots.

Living choices use stable IDs based on crop/cultivar identity and are recomputed on catalogue load or refresh. Cultivar overrides take precedence over the crop flag; inherited eligibility is supported. Old manually created living rows remain saved references and are excluded from new choices.

The connected database was updated on 24 November: eight materials added, 51 duplicate notes cleared, all 60 depths retained. The restricted backup table is `plant_depth_notes_backup_202611240030`. The targeted rollback in `supabase/rollbacks/202611240030_depth_notes.sql` restores only notes unchanged since cleanup.

Validation: all 366 tests and the production build pass. Browser fixtures verified category groups, non-editable living entries, flag refresh and bed-layer selection at 320×568, 390×844 and 1440×900 with no overflow or console errors. The existing bundle-size warning remains.

Material rows use the same compact layout and inline actions as Plants. Previous/Next browses the filtered material category; Back to catalogue restores search, scroll and focus. Unsaved edits retain Save/Discard/Stay protection, and saving keeps the current form open.

## Living-plant links — 24 November 2026

Each living entry has View plant, opening its crop or cultivar through the existing plant-detail navigation. Normal plant-catalogue permissions and unsaved-change protection apply. Back to catalogue restores mulch search, scroll and focus and reloads flag-derived choices after editing. If the entry is no longer eligible, focus returns to search. Living materials still have no independent Edit/Remove controls here.
