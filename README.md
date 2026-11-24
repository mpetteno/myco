# Myco

A garden layout app built with Vite, React, TypeScript, react-konva and Tailwind CSS.

## Development

Use Node.js 26, or another supported release compatible with the development
tools (Node 22.22.2+ or 24.15+).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The development server also accepts connections
on the local network for testing on a phone.

```sh
npm run build      # Check TypeScript and build to dist/
npm run typecheck  # Check TypeScript only
npm test           # Run isolated auth, storage and PostgreSQL access-rule tests
npm run preview    # Serve the production build locally
```

## Structure

- `src/app`: application entry and global Tailwind import.
- `src/features/auth`: email/password accounts, session handling and account panel.
- `src/features/gardens`: saved gardens, picker, creation, naming and autosaving.
- `src/features/sharing`: owner-managed access by existing users' email addresses.
- `src/features/catalogue`: app-wide plant families, plant types, spacing recommendations and companion guidance.
- `src/features/mulch-catalogue`: app-wide mulch materials, administrator forms and storage.
- `src/features/mulch`: bed mulch rectangles, ordered layers, catalogue snapshots and plant clearances.
- `src/features/history`: dated garden snapshots, inspection and corrections.
- `src/features/work-calendar`: dated task planning, combined Work calendar and history inspection.
- `src/features/activities`: planned work and completed bed checkpoints.
- `src/features/area-editor`: planting, mulch and area canvas.
- `src/features/plan-camera`: shared garden/bed zoom, focus and pan controls.
- `src/features/planting`: per-bed planting areas, row previews, capacity and plan-specific overrides.
- `src/features/bed-editor`: dedicated bed screen, responsive controls and draft navigation.
- `src/features/suggestions`: automatic seasonal, spatial-history, rotation, companion and care advice. See [suggestions](docs/suggestions.md).
- `src/features/garden`: garden screen, dimensions, grid and layout state.
- `src/features/beds`: bed forms, drawing and placement rules.
- `src/shared/ui`: small reusable buttons, fields and modal sheets.
- `src/shared/hooks`: browser sizing and theme hooks.
- `src/shared/supabase`: shared Supabase client configuration.
- `supabase/migrations`: versioned SQL schema and access rules.

Sign in with email and password, or choose **Create an account**. If Supabase
requires email confirmation, check your inbox before signing in. **Account** in
the top bar shows the current email and provides sign-out for this device.
See [authentication setup](docs/authentication.md) for project configuration.
Apply the [garden migrations](docs/saved-gardens.md) before using the editor.

Once signed in, choose **Create a garden**, enter its name, width and length,
then select **Create garden**. Tap the garden name in the top bar to switch
gardens or create another one. Use **Garden settings → Rename garden** to rename it.
Use **Garden settings → Garden size** to change dimensions. Dimensions must be at
least 5 cm and round to the nearest 5 cm when applied. You can update them with
the same form, which opens with the current dimensions and closes after a successful save.
The empty green garden shows a repeating 5 cm grid and fits entirely into the
drawing area, preserving its proportions. The view automatically chooses between
0° and 90° to use the largest possible scale for the available screen space.

Use **Add bed** to open the form for a rectangular bed with a name, width and length.
Bed dimensions must be at least 5 cm and snap to the nearest 5 cm. New beds occupy
the first free space on the grid, scanning from the top left without overlapping.
If no space fits, the form asks for smaller dimensions or a larger garden.
Select a bed in the drawing and choose
**Edit bed** to open its dedicated editing and planning screen. Its **Settings**
controls edit the name and dimensions, and **Back to garden** returns to the layout.
Editing sizes in the form keeps its
top-left corner fixed and rejects overlap or overflow. Shrinking the garden is
also rejected if it would put a bed outside the boundary.

Drag a bed with the mouse or a finger to move it. Its position snaps to the 5 cm
grid throughout the drag and is clamped to the garden boundary. If a position
would overlap another bed, it stays at the last valid position. Dropping the bed
updates the layout state. Dragging beds and resize handles edits the layout.
The garden does not scroll; the whole layout stays visible above the toolbar.

Selected beds show live visual positioning guides, including while moving or
resizing. Each side shows the gap to its nearest facing bed or, when there is
none, the garden border. Blue measurements indicate border gaps and amber ones
indicate bed gaps; all distances are in centimetres. Beds that only face each
other diagonally are not treated as side gaps. Dashed purple lines show exact
edge-to-edge or centre-to-centre alignment with another bed or the garden.
Guides are visual only and do not add any attraction or snapping beyond the
existing 5 cm grid. Settings → Position in garden also supports numeric positions.
Area editors offer Position & size for keyboard and precise input.

Select a bed, then choose **Resize bed** in the toolbar to show its eight resize handles. This replaces the Beds list button. New beds start in Resize mode. Choose **Done resizing** to hide handles; selecting a different bed also exits Resize mode. **Edit bed** remains available while resizing. Drag an edge
handle to change one dimension, or a corner handle to change both. The opposite
edge or corner stays fixed. Resizing snaps to 5 cm, stops at the garden boundary,
and keeps a minimum width and length of 5 cm. Overlapping attempts keep the last
valid size. Areas inside the bed scale with it on the 5 cm grid, retaining shared
edges, crop snapshots, row counts, density and mulch layers. Shrinking stops when
an area cannot fit its plants' minimum clearances and chosen rows. Bed settings
use the same resizing rules. One save and Undo step include the bed and its areas.
Handles have enlarged touch
targets, and dropping a handle saves its size. Focus the garden drawing and use
arrow keys to select beds, Enter to edit, and Escape to deselect.
Each bed's name follows its longer side: horizontal
for wide or square beds, vertical for tall beds. A size badge after the name shows
width × length in centimetres and updates live during resizing. Labels keep a
readable screen size and are not clipped to small beds. Click or tap empty space
to clear the selection.

Select a bed and use **Ctrl/Cmd+C**, then **Ctrl/Cmd+V** to create an independent bed with the copied
dimensions in the first free space. Copies receive names such as “Herbs copy”
and “Herbs copy 2”, and the new bed is selected for editing. Repeated pastes use
the original copied snapshot, even if that bed is later edited.
If no space fits, paste reports the problem and keeps the copied bed available.
The shortcuts work outside text fields, without interfering with normal text
editing. **More → Bed actions** provides controls on all devices
to edit, copy, paste or delete the selected bed. Paste remains available after
deselecting a bed, provided a copy exists. This clipboard belongs to the app
and clears on reload.

Press **Delete** or **Backspace** outside text fields to remove the selected bed
and clear its selection. With no selected bed, these keys do nothing to the
garden. Input fields, text areas and editable text retain their normal typing
behaviour. A copied bed remains available to paste even after deleting its source.
Garden keyboard shortcuts are suspended while a modal panel or the bed editor is open.

The screen adapts to desktop and phone sizes and follows the device's light/dark
setting. The garden starts without beds.
The drawing uses the full screen width and the space between the compact Myco
top bar and the bottom toolbar, without a desktop width cap or an action-status
row. The garden initially is centred and uniformly
scaled to fit the entire drawing area, with a small margin for resize handles.
Its longer dimension follows the longer dimension of the available view: usually
horizontal on desktop and vertical on a portrait phone. Turning the screen
recalculates the view without changing garden measurements or bed positions.
Distance labels stay upright and bed labels follow their bed’s displayed longer
side. **Zoom in / Zoom out**, **Fit garden**, **Focus bed** and **Pan** use the same
controls as the bed editor. Wheel zoom follows the pointer; touch supports pinch
and two-finger pan, or one-finger pan with Pan enabled. Pan disables bed dragging
and resizing; Resize bed returns to editing. View changes do not save or enter
Undo history, and selection keeps the canvas size and camera stable.
Garden settings are available through **Garden settings → Garden size**.
Forms and help open only when requested. Selecting a bed keeps the canvas visible and does not open
its form automatically. Panels appear as bottom sheets on phones and centred
dialogs on larger screens. They support Close, backdrop dismissal and Escape.
Bed editing uses a full screen with a drawing, top bar and bottom toolbar.
Its controls sit beside the drawing on desktop and expand below it on phones,
without a popup. The drawing fills the remaining area and retains its proportions.

The viewport includes safe-area padding for notches and home indicators. Panels
follow the visual viewport and scroll internally so inputs remain accessible
when the on-screen keyboard reduces the visible area. This is browser layout
support for future Capacitor packaging; no Capacitor project or native build is
configured yet. Native keyboard and safe-area behaviour still need verification
in the eventual Android/iOS shells.

All garden geometry uses centimetres; only the canvas rendering boundary uses
screen pixels to fit the garden to its container.

Supabase stores each user's gardens, including names, dimensions and beds.
Edits save automatically after form submissions and finished drags. The status below
the garden name indicates saved or pending changes; failures offer recovery.
Switching gardens and signing out wait for pending saves. Reloading opens the
most recently updated garden. Row Level Security restricts access to the owner
and added editors. Native Capacitor packaging remains an upcoming step.
See [saved gardens](docs/saved-gardens.md) for the schema, failure handling and tests.

Use **Garden settings → Share garden** to add an editor by their confirmed account email, view
editors or remove access. Everyone with access can edit the garden's name,
dimensions and beds; only its owner manages sharing. Shared gardens appear in
the recipient's garden picker, marked **Shared · Can edit**. The picker refreshes
when opened and offers **Refresh gardens**. Sharing sends no email and requires
an existing account. See [sharing](docs/sharing.md) for access and collaboration details.

Use **More → Plant catalogue** to browse and search families, plant types and
companion rules. Catalogue administrators can add and edit entries; garden
ownership and sharing do not grant catalogue administration. Plant types inherit
family spacing defaults where their own values are empty. Companion and caution
rules can connect two families, two plant types, or a family and a plant type.
The catalogue starts empty. See [catalogue setup](docs/catalogues.md) for database
roles and the agreed planning rules.

Use **More → Mulch catalogue** to browse and search mulch materials. Catalogue
administrators can add and edit organic and synthetic types with a name and optional notes. Starter materials are supplied by migration `202611240030_mulch_materials_and_depth_notes.sql`. Living choices come automatically from eligible crop/cultivar flags and are managed in Plants. See
[mulch](docs/mulch.md) for setup. In the bed editor, **Mulch** adds independent
rectangles with ordered layers. Choose materials, reorder layers or preview a
lower layer. Every layer leaves a 5 cm radius of bare soil around plant points.
Planting and mulch save automatically to the garden plan.

Open **Calendar → Record garden changes** after implementing the whole plan to capture a completed snapshot with a
date, title and notes. Record bed changes confirms only the selected bed. The working layout continues to autosave; recorded events
stay unchanged unless explicitly corrected. Use Calendar to choose a date and select individual records from its agenda,
including multiple records on one day. **Return to current plan** restores
the editable current layout. See [layout history](docs/history.md) for setup and
date semantics. Choose a calendar date and **Add past garden edit** (or
**Add past bed edit** from bed history) to edit a historical draft. Select a
completed event and **Edit history record** to correct its contents, date, title
and notes. **Save history record → Save record** records these changes explicitly,
retaining prior revisions. Later records and the current plan stay unchanged.
Select an event and **Delete history entry → Delete entry** to remove it from
history after confirmation. This preserves later snapshots and the current plan.
There is one autosaved plan. **Saving…** appears while saving and disappears on success; resolve any save error before closing the app.
Both editor toolbars open the same Calendar panel on the right, or below the drawing on phones, taking space in the editor layout. Garden shows all beds; Bed shows its own records plus garden
checkpoints. Selecting a date previews the latest completed state on or before
that day; the agenda selects exact records. There are no record navigation
arrows. Planned tasks leave the drawing unchanged. Return to current plan or
Close calendar restores the mounted editor and unfinished fields.
**Focus area** zooms within the bed
page; wheel/pinch zoom and **Pan** change only the view. **Fit bed** resets it.
**Advice** keeps Suggestions separate from editable settings. Selection, resize
controls and feedback keep the canvas stable. See [planning and area editing](docs/activities.md).

Use the garden’s **Summary** for total plants by type across all displayed beds
and the area occupied by their full rectangles in m². It follows historical
views as well as the current plan.

With no bed selected, the toolbar offers **Add bed**, **Summary**, **Calendar** and
**More**. Garden More contains **Garden settings** and **Paste bed**. Selecting a
bed changes the toolbar to **Edit bed**, **Resize bed**, **Bed summary**, **Calendar** and
**More**; bed More contains **Copy bed** and **Delete bed**. Click empty space or
press Escape in the drawing to return to garden actions.
The top-right **Menu** contains workspace destinations, **Help** and **Account**.
Sign-out waits for pending saves and protects incomplete planting and history drafts.

Select a bed and choose **Edit bed**. On desktop,
double-click a bed or planting/mulch area to open its editor. Add rectangular areas, assign one plant type to each,
and preview rows along the width or length. Move or resize areas with mouse or
touch. **Split selected area** divides its longer side. The planner shows total
and per-area plant/row counts, with catalogue spacing inherited from families.
Each area has its own row direction, initially along the bed's longest dimension.
New areas start with 2 rows. Choose a row count, or leave it empty to calculate
rows from spacing. Rows keep the chosen spacing and split the remaining space
between opposite borders. The plant type defines minimum border clearance
(default 15 cm); row gaps shrink only when needed to retain it. Live edge-to-row and centred row-to-row
measurements turn red below catalogue recommendations. The area name and size
sit above the drawing, and the 5 cm grid remains visible across planting areas.
Reset buttons beside row count and plant spacing restore two rows or the saved
catalogue plant distance independently. Change spacing or turn off cross-area
spacing checks to override guidance;
companion cautions remain advisory. Valid changes save automatically, with no
Apply plan button. Expanding an area shrinks touched neighbours horizontally
and vertically while preserving their row counts; resizing stops when a
neighbour no longer fits. Returning waits for pending saves; invalid fields
require correction or discarding. Planned plant points also
appear in the main drawing. See
[planting plans](docs/planting.md) for placement, persistence and limits.
**Summary** replaces the bed Plan menu with plant totals by type, per-area counts
and dimensions, surface sizes in m² and mulch totals. Planting settings and
catalogue access are under **Areas**.

See [deployment preparation](docs/deployment.md) for Supabase configuration and
the recommended Cloudflare Pages hosting settings.

Setup references: [Tailwind with Vite](https://tailwindcss.com/docs/installation/using-vite)
and [react-konva](https://konvajs.org/docs/react/index.html).
Dragging follows [Konva's drag and drop guidance](https://konvajs.org/docs/react/Drag_And_Drop.html).
Mobile layout uses [CSS environment variables](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env)
and [native modal dialogs](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog).

Use the sun/moon button to switch the wood-and-mushroom light/dark palettes.
The preference stays on this device and updates both controls and the canvas.
See [appearance and palette values](docs/appearance.md) for review.

## Localization

Recording actions and forms use a typed English message catalogue, with fallback
and a React provider ready for future languages. See [localization](docs/localization.md)
for adding a catalogue and migrating more screens. English is the only shipped language.

Undo restores up to 20 recent local edits, including deleted beds, removed areas and cleared planting/mulch. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. A new edit clears redo. Garden and bed editors keep separate edit histories, cleared when their editor unmounts or the app reloads. Clear area plan requires confirmation. Edit selected area opens the phone inspector over the canvas without moving the bed. See [UI/UX review and validation](docs/ui-ux-review.md).


Keyboard copy/paste uses Ctrl/Cmd+C and Ctrl/Cmd+V: a selected bed in the garden,
or a selected area in the bed editor. Area copies include planting,
seed-mixture snapshots and ordered mulch layers with fresh IDs. Copy areas
between beds in the same garden; paste uses free space without shrinking neighbours.
Undo/redo follows the active editor and autosaves through the normal queue without
recording completed history. Native text shortcuts are preserved, and dialogs,
read-only history and save conflicts block editor shortcuts.


The top-right **Menu** exposes **Gardens**, **Catalogue**, Help and Account.
Editor **Calendar → Open full calendar** opens **Work**, a month and agenda
view of dated tasks and completed garden/bed records. Filter the current garden,
selected gardens or all accessible gardens, then bed, status and activity. **Plan
activity** stores a date, title, notes and optional bed; it creates no layout copy.
**Work to do** adds a generated, editable recap and checklist from the selected
saved plan. Review planting quantities and mulch layers, add/remove steps and
check progress, then Save task. Regeneration asks before replacing edits.
Checklist progress and completion remain separate. Apply
`202611240035_task_work_checklists.sql` to enable checklist storage; it is applied
and verified on live Supabase as of 24 November 2026. Refresh Calendar to reload
its checklist availability.
Edit/reschedule or cancel planned work. **Record completion** requires an actual
date and confirmation that the latest saved garden/bed matches the work done;
it atomically records history and completes the task. Linked records appear once.
**Open history** inspects and corrects a record while preserving the editor draft.
Migration `202611240034_dated_garden_tasks.sql` enables dated tasks and is applied
and verified on live Supabase (24 November 2026). Existing completed history remains available without it.
**Seasonal guidance** remains a separate view for the active garden’s location;
its **Plan an activity** button prefills a task for explicit review and saving.
See [planning and completion](docs/activities.md).
Catalogue browsing uses Plants and Mulch groups. Selecting a garden
bed replaces Summary with Edit bed in the same toolbar row, preserving canvas size.
Seasonal guidance supports monthly and annual views, crop and activity filters,
and a current-garden filter. Unsaved catalogue navigation offers Save and leave,
Discard and leave, or Stay. Apply migration `202611190029_calendar_cleanup.sql` for
calendar range normalization and redundant imported-note cleanup; see
[catalogue and calendar details](docs/catalogues.md).

Page headers use a fixed 72 px height, left-aligned 16 px titles,
and a reserved subtitle/status line. Dialog titles use the same typography,
are centered and wrap in a header at least 72 px tall. Equal space for Back and
Close keeps them centered with or without Back. Dialogs have no subtitle row or
theme toggle; Close stays on the right.
Popup content omits repeated headings and summary names. Creation uses the
title **Create garden**, and the app menu uses **Menu**.
A consistent 44 px chevron Back control
shows its destination through an accessible label and tooltip. Details use this
header action to return to their list; Catalogue and Calendar visits return in
reverse order. Back retains the editor draft and existing unsaved-change checks.
On narrow screens, save status takes precedence over secondary measurements.
The garden overview keeps the Myco wordmark and centered garden-selection dropdown;
the wordmark hides visually on phones to leave room for the garden name.
Catalogue is available only from the top-right Menu, including before creating
a garden. Garden selection contains only garden picking and creation.
The light/dark theme control appears only in main page headers.
Its separate canvas indicator shows **Saving…** only during autosave. Failures
show an error with retry/recovery controls; successful saves leave no label.
These messages overlay the drawing without moving it or the garden selector.

Garden owners can use **More → Delete garden** after confirmation. It waits for
pending saves and permanently removes the garden, beds, history and sharing.
Apply `202611240032_delete_garden.sql` to enable the owner-only, revision-checked
operation; direct table deletion remains denied. See [saved gardens](docs/saved-gardens.md).


Catalogue family pages link to their crops; crop pages link to their cultivars.
Crop and cultivar pages also link back to their parents. Previous/Next follows
the filtered list that opened the entry, or the related child list, without
wrapping. Back to catalogue restores search, scroll and the originating action.
Unsaved changes use the existing Save/Discard/Stay dialog before navigation.
In planting controls, Filter by family narrows crop choices without changing
the current planting; choosing a crop then applies it through normal autosave.

**Area position & size** edits area bounds separately from **Plant clearances**.
Row areas support four per-edge minimums, in 5 cm steps at or above the saved
crop minimum. Actual gaps appear beside the controls and in Summary. Fixed rows
compress their gaps when necessary; automatic rows recalculate their count.
Overrides remain in cm through moves, resizes, copy/paste and Undo.
Apply `202611240033_area_minimum_clearances.sql` for matching database validation;
existing gardens and historical snapshots are not rewritten. See [areas](docs/areas.md).

Catalogue **Avoid after** includes the crop’s own family automatically, including
for cultivars. Explicit favourable rules are labelled as exceptions and retain
their precedence. Suggestions uses the same family fallback while keeping
rotation-interval warnings; an interval replaces duplicate automatic advice.
This calculated default adds no catalogue rows and needs no database migration.
