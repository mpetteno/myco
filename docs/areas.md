# Unified bed areas

A bed has one `areaPlan` document:

```ts
{ version: 5, respectAreaSpacing: false, areas: PlanArea[] }
```

Every area has a stable ID, rectangle in bed coordinates, purpose
(`crop` or `green_manure`) and an ordered `mulch` array. Its planting `kind` is:

- `rows`: a crop/cultivar snapshot, direction, chosen row count and spacing. Uses
  the existing balanced row geometry and captured minimum border distance. Rows
  always use Harvest crop purpose.
- `broadcast`: a crop/cultivar or mixture snapshot, density and density unit.
  Density always uses `g_m2` (grams per m²), for crops and mixtures. The editor
  shows g/m² on the density field and has no unit selector. Quantity is density
  × area in m². Mixture component weights use the saved percentages.

**Green manure** always uses a seed mixture with broadcast sowing. Broadcast sowing can also use Harvest
crop purpose. A
mixture is a separate catalogue composition of crops/cultivars, rather than a
botanical hierarchy level. Seed mixtures are used only for Green manure.

## Editor

Use **Add area**, then **Areas** or **Open area editor**. The controls share one
**Purpose** selector first. For Harvest crop, the **Planting method** selector
below it offers **Plant rows** or **Broadcast sowing**. Green manure uses broadcast
sowing automatically and hides the method selector. Area names automatically
use the selected cultivar name, crop name when no cultivar is selected, or seed
mixture name. There is no Area name field. Choose planting settings and optional
mulch layers. Crop planting first selects a
**Crop**, followed by an optional **Cultivar** belonging to that crop. Switching
crops clears the cultivar. Saved cultivars remain visible if later removed from
the catalogue. Green manure shows only a **Seed mixture** selector. Harvest
areas show only **Crop** and optional **Cultivar**, with no sowing-material
selector. Seed mixtures are exclusive to Green manure. Switching from a mixture
to Harvest crop clears its density so a crop-specific rate can be entered.
If a crop is available, new areas begin with its row settings. With only seed
mixtures available, they begin as Green manure broadcast drafts requiring a density. A crop or
mixture must exist before an area can be created. Choosing Green manure switches
rows to broadcast sowing; choose Harvest crop before selecting rows again.

Switching method keeps the rectangle, purpose and mulch; its label follows the
planting selection. Newly selected
broadcast sowing requires an explicit density before it autosaves. Seed mixture
proportions are edited only in the shared catalogue; the area shows its captured
composition and calculated weights. Refreshing references does not update saved
snapshots; selecting a catalogue entry again adopts the current revision.

Mulch belongs to the area and has no independent rectangle. Zero to eight layers
run bottom to top; deleting the final layer is allowed. The top layer renders
across the area with 5 cm clearance around individual row plants. Broadcast
areas render as a filled surface, without fabricating individual plant positions.
Seed quantities appear separately from row plant counts in bed and garden recaps.

The 5 cm grid, non-overlap, neighbour resizing, autosave, pending-save navigation
and invalid-draft protection apply across all methods. Up to twelve areas fit
in a bed. Resizing rows must preserve their clearances and chosen row counts;
broadcast areas can shrink to a 5 cm rectangle. Splitting copies
content but creates independent area/layer IDs. Resizing changes seed quantity
without changing density or mixture composition.

## Persistence and history

`Bed.areaPlan` is the sole source for new saves. Transient projections reuse the
existing row geometry and mulch rendering code; they are not persisted as extra
`plantingPlan` or `mulchPlan` properties. Client and database reject documents
containing both the unified and legacy fields. Garden resizing and copy/paste
also validate/preserve the new areas.

Apply migration `202611170021_unified_areas_seed_mixtures.sql` after 020. It adds
mixture tables, the administrator-only RPC, and unified area validation to garden
and history writes. It converts existing format-5 row layouts without standalone
mulch into the new structure, preserving IDs, choices, geometry and snapshots.
Garden/bed records and existing history are not deleted. Older history keeps its
legacy renderer. Editing a legacy row layout creates a unified draft only on the
first valid edit; opening it or editing bed metadata does not rewrite it.

Legacy overlapping standalone mulch rectangles do not have an exact equivalent
in the new attachment model. Such an old layout requires clearing before editing;
its recorded snapshot remains available through the legacy read-only renderer.

Green-manure sowing, cutting and incorporation can be recorded through existing
history titles/notes. These actions do not automatically turn standing plants
into mulch; add the resulting surface material as an optional layer when needed.

## Verification

Tests cover client/database validation agreement, mixture totals and cultivar
ownership, administrator/reader/anonymous permissions, atomic rollback and stale
versions, saved snapshots, densities and seed quantities, resizing and copying,
all three editor methods, attached mulch, autosave failures, invalid drafts,
catalogue section navigation and history. No live test mixtures are inserted.


Migration `202611170022_planting_method_purposes.sql` supports format 2 and enforces
its two methods and harvest-only row purpose in garden and history writes.
Format-1 snapshots remain readable. An older unplanted area requires choosing a
current planting method before its edits save; no density is guessed. Older row
areas use Harvest crop in the editable draft. Opening a legacy area alone does
not rewrite its saved document.


Migration `202611170023_green_manure_mixtures.sql` introduces format 3, requiring
seed-mixture snapshots for Green manure in new garden and history writes. Older
crop-based Green manure snapshots remain readable; an editable draft requires
choosing an actual seed mixture before saving. Missing mixtures do not cause a
fallback to a catalogue crop or an invented valid composition.


Legacy seed-count snapshots remain readable with their original quantities. When
editing one, enter a new rate in g/m²; the editor clears the density because a
seed count cannot be interpreted as a weight. Saved gram-based densities are
preserved.


Migration `202611170024_harvest_crop_selection.sql` adds format 4, requiring a
crop/cultivar selection for Harvest crop broadcast areas, a seed mixture for
Green manure, and g/m² for new broadcast densities. Prior documents remain
readable. Editing an older Harvest crop mixture requires choosing a crop and
entering its density; its mixture is not silently reclassified or overwritten.


Legacy custom name values remain in saved documents for schema compatibility but
are ignored when displaying area labels. Editor titles, area lists, canvas labels,
recaps and derived mulch labels use the selected planting reference automatically.


Migration `202611170025_independent_area_spacing.sql` adds format 5. Each row area
uses only its own row spacing, plant spacing and minimum border clearances.
Adjacent areas never remove one another's plants. The cross-area spacing control
and override warnings are removed. Current garden plans have that check disabled;
area bounds, planting snapshots, row settings and mulch remain intact. Historical
snapshots retain their prior algorithms and recorded counts. The legacy boolean
is kept as `false` in new documents for schema compatibility.


The area settings pane contains fields, action controls and validation messages.
Inline explanatory paragraphs, reference summaries and general guidance are
omitted. Seed totals and saved mixture component weights are read-only fields;
missing required selections and row-spacing warnings remain visible.
