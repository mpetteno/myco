# Bed planting plans

## Using the planner

Select a bed, then choose **Edit bed**, open it from **Beds**, or double-click
it on desktop. Each opens a dedicated full-screen bed
editor with a top bar, bed drawing and bottom command toolbar. Any garden editor can plan plants;
catalogue administrator access is only needed to change the shared references.

Desktop controls sit beside the canvas. On phones, **Areas**, **Bed** and **Recap**
expand controls below the drawing; **Hide controls** restores the full drawing
area. These controls are part of the page, not modal dialogs. Both editor screens
follow the visual viewport so the drawing resizes when the on-screen keyboard
opens, and keep the safe-area padding for device edges.

**Add area** creates a rectangular planting area in available space. The first
area fills an empty bed. Assign one plant type per area. **Split selected area**
in **Areas** controls
divides its longer side into two grid-aligned rectangles; select a different
type for the new area as desired. Drag areas and their edge/corner handles with
mouse or touch to move or resize them. The selected-area menu is an alternative
to selecting an area in the drawing.

Each area chooses rows along the original bed width or length in **Areas**
controls. New areas default to the bed's longest dimension (width for a square).
Splitting an area copies its chosen direction and row settings. The view can turn to fit the
screen, while the dimensions and row directions keep the bed's original axes.
Coloured plant points and dashed row guides show the current arrangement. Total
and per-area plant/row counts update after area gestures and spacing changes.
The bed editor has a visible 5 cm grid over both the bare bed and its planting
areas, in light and dark themes.
The area name and live dimensions sit in a fixed-height bar above the canvas.
They are not drawn across plants. That bar keeps a stable height as warnings
appear, so the viewport scale does not jump in the middle of a gesture.

New areas start with **2 rows**. Leave **Number of rows** empty to calculate rows from the chosen spacing. Enter
a positive whole count to centre that many rows at the chosen spacing. Border
gaps share the remaining space. If they would fall below the plant type’s saved
minimum border distance (15 cm by default), rows move closer
to keep that minimum. Rows remain on the 5 cm grid; compressed neighbouring gaps
and opposite borders can differ by 5 cm. One row is
centred. The controls show the resulting minimum/maximum gap, replacing the
row-spacing input while a count is set. Too many rows for the physical grid
show an error instead of silently reducing the count.

Plant-type spacing inherits each missing distance from the family. Missing
recommendations require a manually entered positive distance. The form shows
the saved reference, chosen distances and actual grid spacing. **Use current
catalogue spacing** explicitly reloads that type's current reference values.

The garden opens in **Plan** mode. Valid planting and mulch edits autosave through
one revision-checked queue; there is no Apply plan button. Both the bed page and
focused area editor show Saving / All changes saved / Save failed. Returning
waits for pending saves and stays in the editor after a failure. Invalid fields
stay editable and require fixing or discarding before navigation. Unsaved edits
warn on browser unload. Completed history changes only through explicit recording.

Expanding an edge or corner shrinks overlapping areas in the same planting plan.
Horizontal and vertical edges can adjust several neighbours together, including
diagonal neighbours during corner drags. Neighbours retain their opposite borders,
plant types, orientations and chosen row counts; plant positions/counts recompute.
The complete resize is rejected if any affected area cannot keep its grid,
saved plant-type clearances or rows. Spacing warnings remain advisory. Moving an area still
stops at other areas; shrinking an area leaves free space instead of expanding
its neighbours. Live previews use the same checks as the atomic save.

**Bed** controls save the bed name and size immediately through the existing
garden save queue. Size changes cannot crop saved or draft planting areas.
**Areas** also provides cross-area spacing settings, catalogue access, reference
refresh and **Clear planting plan** (autosaved). **Recap** is a read-only summary:
plant totals grouped by type, per-area plant/row counts and dimensions, bed and
assigned surface sizes in m², space outside planting areas, companion guidance
and mulch-area/layer totals. Counts follow the current preview, including
cross-area spacing checks. Invalid drafts explain why counts are unavailable. **Mulch** controls independent rectangular areas
and their ordered material layers; see [mulch](mulch.md). Planting and mulch save
together, and clearing one preserves the other.
Switching controls or opening the catalogue keeps the draft. Applied plant points
also appear in the main garden drawing. Garden copy/delete keyboard shortcuts
are inactive inside the bed editor to protect the bed while working with areas.

## Garden recap

The garden toolbar also has **Recap**. It groups plants by their saved type ID
across every displayed bed, using the same geometry, spacing overrides and
cross-area checks as the drawing. It shows the total bed footprint in m²,
including beds with no planting plan. Totals follow historical snapshots without
upgrading their saved formats. Opening the recap never saves an edit or records
a history event. A malformed planting plan leaves the footprint available but
explains why complete plant totals are unavailable.

## Placement and overrides

- Every area respects its saved plant-type minimum at row sides and row ends
  (15 cm by default).
  Row-side clearances grow to split the space left over at the chosen row spacing.
- Coordinates are relative to the bed and lie on the 5 cm grid.
- Positive chosen plant spacing and automatic-row spacing round upward to the next 5 cm.
- Explicit row counts keep the chosen spacing when it fits, compressing evenly
  on the grid only when needed to preserve its saved minimum border clearance.
- Area rectangles cannot overlap or leave the bed. Their margins are measured
  from the area's own borders, so moving an area moves its rows without changing
  its relative clearances. There is no additional fixed bed-border margin.
- Automatic spacing fits as many rows as possible at the chosen spacing and
  centres leftover space. Opposite clearances can differ by one grid cell and
  stay at or above the minimum. Plant positions along each row likewise centre
  unused space while keeping their chosen spacing and saved minimum end clearance.
- Resize handles stop at the last fitting size before margins or chosen rows
  become impossible, and stay visually above distance labels.
- Areas fill in list order.
- With cross-area checks enabled, later candidate points are omitted when both
  their horizontal and vertical gaps to an earlier area's point are below the
  larger applicable spacing on those axes. Each area's direction maps its plant
  and row distances to the bed axes, allowing perpendicular row arrangements.
  For a chosen row count, the minimum resulting row gap is used as its override.

For a single 100 × 200 cm area, rows along the length with 30 cm between plants
and a catalogue recommendation of 40 cm between rows place the default 2 rows
at x = 30 and 70 cm, giving 30 cm side borders and 6 plants per row. Shrinking
the area width to 60 cm places rows at x = 15 and 45 cm: the 15 cm borders stay,
while the 30 cm row gap triggers a warning. Choosing 3 rows in the original
100 cm width places them at x = 15, 50 and 85 cm, giving 18 plants with 35 cm
row gaps. Growing to 140 cm restores 40 cm row gaps with 30 cm borders.
Across-area allocation
is deterministic and conservative, rather than a global packing optimization.
Requested rows remain visible even if cross-area checks remove all their plant
points. Counts explicitly identify empty rows, with a warning explaining how to
adjust areas or override those checks.

Selected areas show live measurements from their borders to the outer rows and
row endpoints, plus representative row-to-row gaps centred along the rows,
separate from the border guides. Normal measurements are
blue; measurements below the corresponding catalogue recommendation are red
and include an exclamation mark. Border recommendations use the saved plant-type
minimum where present (legacy references retain their previous half-spacing
measurements); row-gap recommendations use the full catalogue row spacing.
Adjacent row guides also turn red when their gap is too small. The same warning
appears in text above the drawing and in area controls. These are advisory:
compressed rows remain applicable while margins and the physical grid fit.

The measurements use the saved type/family reference selected for the plan.
The **Reset** button beside Number of rows restores the two-row default. The
**Reset** beside Between plants in a row restores that field’s saved catalogue
recommendation; it is disabled if no recommendation was saved. Each reset leaves
the other field unchanged. Selecting a plant type captures its current catalogue
reference. A maximum of eight
labels is shown per selected area to keep large plans readable. Measurements
and the size bar use transient drag geometry, so they update before release.

Enter custom spacing to override reference values. Turn off **Keep spacing
between areas using the larger requirement** to explicitly permit closer
cross-area arrangements. These exceptions stay in the plan. They do not change
the shared catalogue. Companion suggestions, cautions and unknown combinations
are shown as guidance; cautions never disable applying the plan.

For responsive previews and bounded saved documents, each bed supports up to
12 areas and 20,000 candidate plant points before cross-area filtering. Larger
plans show an error and require larger spacing or smaller areas. Counts are
never silently truncated.

## Persistence and geometry

Apply `supabase/migrations/202611160004_bed_planting_plans.sql` once after the
previous migrations, followed by `202611160005_area_rows.sql`,
`202611160006_spacing_margins.sql`, `202611160007_fixed_area_margins.sql` and
`202611160008_balanced_area_rows.sql`. The first adds a
garden check constraint and validation function; the second extends validation
to per-area row controls and 15 cm clearance. The third adds spacing-derived
area margins, the fourth adds fixed 20 cm margins, and the fifth adds balanced
rows with 15 cm minimum margins, without rewriting saved plans.
Existing gardens without planting plans remain valid. Garden owner/editor RLS,
version checks and save-failure handling remain in force. Plans require no new
secret keys, storage bucket or administrator role.

`Bed.plantingPlan` contains a format version, cross-area-check
choice, rectangular areas and companion guidance. Each area retains its stable
ID, plant/family IDs, names, catalogue versions, reference distances and chosen
distances. Version-2 areas also store their own `rowDirection` and nullable
`rowCount`. Version-3 plans retain those fields and derive stable area-relative
margins from their stored catalogue snapshots. Version-4 plans use fixed 20 cm
area margins instead. Version-5 plans centre rows at the chosen spacing,
compressing it only to retain the captured plant-type border distance (15 cm
when absent in legacy snapshots). The optional `plant.borderDistanceCm` field
is validated in the client and database by migration 014. Rows and points are generated deterministically from this
configuration. Both client and database validate each explicit count against the
physical grid and the candidate limit.

Existing version-1 plans retain their original 5 cm clearance and global row
direction; version-2 plans retain their 15 cm bed clearance, and version-3 plans
retain their spacing-based area margins; version-4 plans retain their fixed
20 cm minimum margins. This applies when moving a bed or
saving unrelated garden changes. Opening an older plan in the editor
proposes a version-5 draft with balanced rows and 15 cm minimum margins, preserving its
chosen row directions and counts. The first valid edit autosaves the new placement;
opening alone does not rewrite the stored plan. This protects stored
positions and older clients while the frontend is redeployed. Future format
changes must likewise preserve older generators or explicitly migrate plans.

Moving a bed preserves the relative plan. Enlarging a bed preserves the current
areas and count; expand areas in the planner to use the extra space. Shrinking a
bed through forms or drag handles is rejected if it would crop an area. Copies
receive independent plan data and new area IDs. New bed IDs use UUIDs; existing
bed IDs stay unchanged.

Opening an existing plan retains its saved spacing and type snapshots. Companion
guidance for an edited draft uses the loaded catalogue; applying captures it
again. Catalogue edits do not silently rearrange saved plant positions.

This step supports one current layout plan per bed. Season dates, succession
plantings, harvest actions and individual point manipulation remain separate
steps. [Activities](activities.md) schedule planting/mulch work and record the
actual bed after completion. [Layout history](history.md) captures applied planting and mulch
in explicit dated garden snapshots. Mulch areas and layers are part of the current
bed plan and leave 5 cm of uncovered soil around its plant points.

## Verification

`npm test` checks row capacities and orientations, grid rounding, bed-edge
clearance, cross-area larger-spacing rules and exceptions, advisory companions,
splitting, bounds, copying, candidate limits and persistence. The actual database
migrations run in isolated PostgreSQL to verify existing gardens, malformed
plans, shared editing, stale saves, revocation and client/database agreement.
Tests create no live users or live garden data.
DOM interaction tests use React and jsdom, with the canvas and backend stubbed,
to check opening the non-modal bed screen, controls, metadata edits, draft
autosave, invalid-field discard, pending/failed saves and disabled garden keyboard shortcuts.
They do not verify real canvas rendering or device layout.
The suite also covers custom row distribution, single-row centring, independent
directions, impossible counts, version-1 compatibility, transparent grid drawing,
and client/database agreement for version-2 plans.
Version-3 tests cover stable area-relative margins during moves/resizes, resize
gesture rejection at the last fitting geometry, catalogue-based warning
measurements, and persistence of dense-row overrides.
Version-4 checks retain coverage of fixed 20 cm clearances. Version-5 checks
cover the 2-row creation default, balanced margins, compression at 15 cm,
restoring spacing after expansion, centred guides in both orientations, resize
limits and client/database agreement across catalogue spacings.

For browser review, create a bed and add an area, choose a catalogue type, split
the area, choose another type, resize/move it, edit spacing and toggle cross-area
checks. Apply, reopen, reload the page and verify positions/counts. Check the same
flow with touch on a phone and with an account sharing the garden.
