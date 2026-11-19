# Automatic bed suggestions

Bed **Areas**, the focused area editor, and **Bed recap** show suggestions
automatically. Advice uses today's local calendar date; change **Advice date**
to plan ahead, or choose **Today** to reset it. The override lasts only for the
current bed-editing session. The default date updates at midnight and on focus.
Historical record editors do not show suggestions.

Suggestions combine the garden region's existing growing calendar, crop and
cultivar guidance, directional rotation rules, companions, and recorded crops
on the same physical ground. Region is configured through **Edit garden →
Garden location**. Missing region, calendar entries, spacing, or history are
reported as missing evidence, rather than guessed. No weather or AI service is
used. Catalogue administrators maintain the underlying guidance as before.

## Choosing plants and green manure

Select an area to see a shortlist of crops, cultivars, and seed mixtures. **Show
more** reveals the remaining choices. Each candidate explains seasonal timing,
known rotation and companion benefits/cautions, and row fit where spacing is
known. Seedbed sowing is preparation advice, not a direct-bed planting action.
Explicitly empty calendar entries are unavailable activities; missing entries
remain unknown. Month ranges include their endpoints and may cross December.

**Use in this area** changes the working plan, preserving area identity,
geometry, and mulch. Existing validation and autosave still apply. Green manure
switches to broadcast sowing and requires an explicit sowing density before it
can save. Suggestions never record work as completed. An area must be selected
or added before applying planting choices.

## What history establishes

Ground coordinates combine each recorded bed's position with its area's
position. Rotation evidence follows that ground through splitting, resizing,
bed movement, deletion, and replacement, regardless of IDs. Touching edges do
not overlap. Partial overlaps are shown as a percentage of the target area.
Each seed-mixture component contributes to crop history.

Only completed, nondeleted records on or before the advice date participate.
Frozen display snapshots and legacy bed-scoping rules are respected. Unchanged
checkpoints extend one crop observation rather than creating new sowing events.
The latest preceding crop is resolved independently for overlapping portions.

Snapshot dates describe observations, not inferred sowing or harvest dates.
An unchanged last state may still contain a crop: verify availability before
replacing it. Where a subsequent record removes a crop, that record supplies a
conservative upper bound for rotation intervals. An open observation has no
known removal date. Missing crop history never establishes safe rotation.

Rotation relationships prefer cultivar, then crop, then family specificity;
equally specific conflicting rules resolve to caution. Catalogue rotation
intervals also check recent same-family observations. No default interval is
invented when none is supplied.

## Care and reliability

Care sections show catalogue sunlight, feeding, watering, and planting-depth
guidance. A calendar harvest window does not establish crop ripeness. Uncovered
or unassigned ground in the working plan prompts consideration of mulch or
green manure; it does not establish today's physical soil condition. Watering
and feeding are never labelled overdue without task records.

Editing recomputes advice locally. Returning from history, refreshing references,
and window focus reload the evidence, including corrected/deleted records.
Snapshots and reference data are paginated. Late responses are discarded after
leaving or switching gardens. A history or reference failure has its own retry
and does not block plan editing or turn missing evidence into favourable advice.

Suggestions and date overrides are not persisted. Saved plan and history formats
are unchanged; no new database migration is required. New suggestion text ships
in English and Italian; untranslated existing interface text falls back to English.
