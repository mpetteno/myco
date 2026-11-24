# UI/UX review

Reviewed on 18 November 2026, followed by implementation and browser checks of the main issues. Existing uncommitted work was preserved. The original findings below describe the baseline before these changes.

## Implemented improvements

- Garden and area editors keep up to 20 local undo steps. Undo uses the existing autosave queue and does not restore old server version numbers. Conflict recovery remains explicit; Undo is disabled for known conflicts.
- Deleted beds retain their full planting and mulch when restored. Area deletion and clearing can be undone; clearing the whole plan first asks for confirmation. Undoing an added area from its focused editor returns to the bed.
- Phone toolbars now use one row. A selected area has an explicit edit action when controls are hidden, with space reserved below the drawing. Panel buttons expose their actual expanded state on desktop and mobile; hiding controls returns keyboard focus to the trigger.
- Catalogue opens directly from the garden header and returns to the preserved garden draft. The back label identifies the actual destination. More groups garden tools, bed actions, and workspace tools; copy/paste is visible on desktop as well as touch devices.
- Summary, Settings, Garden settings, and Current plan replace ambiguous navigation labels. Garden and bed headers show readable save status. Long canvas labels truncate and stack their size badge when needed.
- Bed settings accepts numeric garden positions. Area settings accepts numeric bounds. Both use 5 cm input validation and existing overlap/boundary/planting checks. Area expansion retains the existing neighbour-resizing behavior.
- Mulch, position/size, area actions, and plan tools use labelled disclosures. Main planting fields precede destructive tools. Phone inspectors gain more room while a field is focused. History presents the calendar and records before correction/deletion actions. Modal dialogs initially focus their heading.

## Validation completed

Chrome ran with a fresh profile through the bundled IDE launcher outside the sandbox. The local review fixture rendered the real workspace, garden, bed, area, and catalogue components with sample repository data. No real garden records were changed. This validates browser layout and local interactions, not a live Supabase session.

| Viewport | Observed result |
| --- | --- |
| 1440 × 900 desktop, dark | Garden and bed layouts, persistent side inspector, direct catalogue navigation and return; area removal/undo restored two areas and 40 plants |
| 1280 × 800 desktop, light | No horizontal page overflow; internally scrolling side inspector; one-row toolbar |
| 768 × 1024 tablet, light | No horizontal page overflow; mobile-style controls below the canvas and explicit selected-area action |
| 390 × 844 phone, light/dark | Garden and bed screens, one-row toolbars, open/hide controls; garden canvas measured 390 × 723 px |
| 320 × 568 phone, light, mobile/touch emulation | No horizontal page overflow; garden toolbar 65 px high; lower inspector input reachable by internal scrolling |
| 844 × 390 landscape phone, light, mobile/touch emulation | No horizontal page overflow; garden drawing measured 844 × 269 px; toolbar stayed in one row |

Automated validation: `npm test` passed all 320 tests, including recovery during pending saves, full planting/mulch restoration, clear confirmation/cancel, focused-area undo navigation, numeric geometry rejection and saving, panel expanded state/focus return, and direct catalogue draft preservation. `npm run build` passed. Vite continues to report the large application-bundle warning.

Physical-device keyboards, native safe areas, assistive-technology testing, zoom, and live collaborative editing still need their own verification. Browser emulation does not reproduce native keyboards. Broader work such as a persistent desktop bed list, stable custom area names, catalogue navigation restructuring, and a complete task-oriented Help rewrite remains outside this implementation.

## Assessment

Keep the garden → bed → area hierarchy and the drawing as the main workspace. The main opportunities are clearer navigation, predictable selection and controls, and recovery from mistakes. Another visual redesign would provide less value than resolving these workflow issues first.

Useful foundations already present:

- Shared buttons and fields have generous minimum heights, visible focus styles, and persistent labels.
- Sheets use native modal dialogs, labelled headings, Escape dismissal, and internal scrolling.
- Layouts account for safe areas and the visual viewport, including keyboard-related viewport changes.
- Bed and area editors provide dedicated screens, back actions, and save feedback.
- Geometry validation prevents overlaps and overflow; reference-based warnings can remain advisory.
- The palette and canvas share light/dark appearance support.

These are implementation observations, not a completed accessibility or device certification.

## Findings, ordered by priority

### 1. High: destructive edits have no recovery workflow

Deleting a bed immediately removes it from the autosaved plan. Delete/Backspace can trigger this while the canvas is active. Removing an area and clearing the area plan also directly change state without an undo action or confirmation. Completed history is recorded separately, so it is not an automatic undo mechanism for the current plan.

Evidence: `src/features/garden/GardenPage.tsx:49`, `src/features/garden/useGardenLayout.ts:86`, `src/features/beds/useBedDeletion.ts:8`, `src/features/bed-editor/useBedEditor.ts:189`, `src/features/bed-editor/useBedEditor.ts:227`.

Recommendation: add undo for bed/area deletion and spatial edits, with an accessible “Bed deleted · Undo” notification. Confirm clearing all areas and explicitly explain that planting and mulch will be removed. Restore the complete object, including all child areas and layers. Historical record deletion already has a separate confirmation workflow.

Acceptance: keyboard deletion and touch deletion can both be undone; clearing a populated plan requires a deliberate confirmation; failed saves and undo cannot silently replace a newer plan.

### 2. High: mobile selection and the controls panel disagree

The bed inspector starts closed on mobile. Selecting an existing area changes the selected ID and the active tool to Areas, but does not open the inspector. The Areas button can therefore look selected while its controls are hidden. Its pressed state reflects the tool even after “Hide controls”. Desktop always displays the inspector, so the same action behaves differently across layouts.

Evidence: `src/features/bed-editor/BedPage.tsx:35`, `src/features/bed-editor/BedPage.tsx:66`, `src/features/bed-editor/BedEditorToolbar.tsx:12`, `src/features/bed-editor/BedEditorInspector.tsx:20`.

Recommendation: define a single selection contract. On a phone, selecting an area should expose a compact selected-area action strip with an explicit Edit action, or open a compact inspector. Keep a way to retain a large drawing. Give panel toggles accurate `aria-expanded` and `aria-controls`; avoid presenting hidden controls as an active visible tab.

Acceptance: a person can select an existing area and reach its crop/spacing settings without guessing which toolbar action to press; expanded state agrees with visible content.

### 3. High: desktop mouse and keyboard access is incomplete

Copy/paste bed controls are hidden for large screens with a fine pointer, leaving shortcuts as the only interface for those actions. Bed lists expose editing, but moving beds and moving/resizing areas depend on canvas gestures; equivalent numeric position controls or keyboard movement are absent from the reviewed editor forms. A focusable canvas or an image description does not expose those editing operations.

Evidence: `src/features/garden/GardenPanels.tsx:64`, `src/features/bed-editor/BedEditorInspector.tsx:36`, `src/features/garden/GardenCanvas.tsx:33`, `src/features/area-editor/AreaPlanCanvas.tsx:50`, `src/features/beds/BedForm.tsx`, `src/features/area-editor/AreaFields.tsx`.

Recommendation: offer selected-object actions on every device, with shortcuts as accelerators. Add keyboard-selectable objects and arrow-key movement by one grid step, or labelled position and size fields with the same geometry validation as dragging. Preserve the current drawing-first approach.

Acceptance: create, select, position, resize, copy, and delete a bed or area using a keyboard; a desktop mouse user can discover copy/paste without reading Help.

### 4. Medium: navigation mixes workspace destinations with object tools

The garden toolbar mixes Add bed, Beds, Edit bed, Edit garden, Recap, History, and More. More mixes garden switching, seasonal guidance, help, and selected-bed operations. Catalogue is reached through the garden picker rather than a direct workspace destination. On desktop, sheet-based bed browsing hides the canvas instead of allowing persistent browsing beside it.

Evidence: `src/features/garden/GardenToolbar.tsx:22`, `src/features/garden/GardenPanels.tsx:59`, `src/features/gardens/GardensWorkspace.tsx:48`, `src/shared/ui/Sheet.tsx:34`.

Recommendation: distinguish app destinations (Gardens, Catalogue, Account), garden views (Layout, Summary, History), and selected-object actions (Edit, Copy, Delete). Provide direct Catalogue access. On desktop, use an optional bed list beside the drawing; on phones, retain an on-demand list. Preserve pending drafts when switching destinations.

Acceptance: catalogue browsing takes one explicit navigation action from the garden; selected-bed actions stay grouped under the bed name; garden switching remains obvious.

### 5. Medium: mobile toolbars use space unevenly

Below the `sm` breakpoint, the normal garden toolbar uses four columns for seven actions, with More spanning two columns. The bed toolbar places five actions in three columns, leaving the final cell empty. Both toolbars mix immediate actions with view/panel switches. At `sm`, both switch to a single flex row, while inspector layouts remain stacked until `lg`.

Evidence: `src/features/garden/GardenToolbar.tsx:22`, `src/features/bed-editor/BedEditorToolbar.tsx:9`, `src/features/bed-editor/BedEditorInspector.tsx:20`.

Recommendation: keep three or four stable mobile destinations and show Add as a contextual action. Move infrequent settings to a clearly labelled menu. Test the intermediate tablet widths explicitly; breakpoints should follow content fit. Desktop can use a wider toolbar with grouped controls.

Visual check pending: measure remaining drawing space with history and controls open at 320–430 px widths and in landscape. The uneven grid follows directly from source; actual wrapping and comfort need screenshots.

### 6. Medium: important names and state labels need a consistent vocabulary

“Recap” is less explicit than “Summary”; “Bed” opens Bed settings; “Edit garden” opens a settings menu; “Plan” is used as the return action from recorded history. “Area settings” includes reference refresh and clearing the entire bed's area plan, rather than just settings for the selected area. The garden's normal save state is communicated visually by a coloured dot; its accessible label has text, but sighted users must learn what the dot means.

Evidence: `src/features/garden/GardenToolbar.tsx:26`, `src/features/bed-editor/BedEditorToolbar.tsx:11`, `src/features/bed-editor/BedPlantingSettings.tsx:9`, `src/features/history/GardenHistoryBar.tsx:15`, `src/features/garden/GardenPage.tsx:93`.

Suggested vocabulary:

| Current label | Suggested label | Meaning |
| --- | --- | --- |
| Recap | Summary | Totals for the displayed garden or bed |
| Edit garden | Garden settings | Name, dimensions, location, sharing |
| Bed | Bed settings | Name and dimensions of this bed |
| Plan, when returning from history | Current plan | The editable autosaved layout |
| Record garden/bed changes | Record completed work | Explicit checkpoint of work implemented |
| Area settings, for refresh/clear actions | Plan tools | Actions affecting the bed's entire area plan |
| Refresh area references | Update catalogue references | Clarify exactly which saved values change |

Keep technical catalogue concepts in administrator forms; use “Crops”, “Varieties”, “Growing calendar”, and “Mulch materials” as browsing language, with “cultivar” explained where needed. Before renaming reference refresh, verify and describe its actual effects.

Recommendation: show a compact Saved / Saving / Save failed status consistently in garden, bed, and area headers. Rename visible labels together with Help, documentation, accessible names, and tests.

### 7. Medium: dense inspectors put destructive tools before useful guidance

The Areas inspector combines the area selector, split/remove actions, planting fields, mulch layers, reference refresh, clear-plan action, and suggestions in one scroll column. On phones it is limited to 45% of the available parent height. The dedicated area editor also uses a 45% panel, although its purpose is focused editing. The history inspector similarly puts past-edit and destructive actions before its calendar and event list.

Evidence: `src/features/bed-editor/BedEditorInspector.tsx:25`, `src/features/bed-editor/BedAreaControls.tsx:14`, `src/features/area-editor/AreaEditorPage.tsx:42`, `src/features/history/GardenHistoryInspector.tsx:29`.

Recommendation: group selected-area fields as Crop & method, Spacing, Mulch, and Suggestions; use collapsible sections with meaningful summaries. Put delete and clear under a separate actions menu. Let a phone user expand settings or focus the canvas; retain side-by-side settings on desktop. In History, lead with date, selected record, and event list, then offer record actions.

Visual check pending: determine whether the 45% panels remain comfortable with an on-screen keyboard, larger text, and landscape orientation. Do not assume viewport awareness alone guarantees usable remaining height.

### 8. Medium: areas lack stable, distinguishable display names

`areaLabel` derives the display name from the crop, cultivar, or seed mixture. Two areas using the same selection therefore have the same visible name. The selector adds an index, but the focused page heading uses the derived name alone. Changing crops also changes the area's displayed identity.

Evidence: `src/features/area-editor/areaPlan.ts:25`, `src/features/bed-editor/BedAreaControls.tsx:12`, `src/features/area-editor/AreaEditorPage.tsx:28`.

Recommendation: use stable area identifiers such as “Area 1 · Tomato” consistently in the selector, drawing, summary, and focused header. Optionally support user names if needed. Keep the crop as descriptive information. A breadcrumb should retain garden and bed context.

Acceptance: two areas with the same crop can be reliably distinguished before and after editing their planting selection.

### 9. Lower: catalogue browsing and help expose too much structure at once

Catalogue has nine sections in a single dropdown, including reference administration concepts such as calendar coverage. The same overall structure is used for browsers and administrators. Help is a long sequence of paragraphs, with theme instructions before basic garden tasks. This makes learning and finding an answer harder as functionality grows.

Evidence: `src/features/catalogue/CataloguePage.tsx:12`, `src/features/catalogue/CataloguePage.tsx:46`, `src/features/garden/GardenHelp.tsx:4`.

Recommendation: show Plants, Calendar, and Mulch as visible groups on desktop and compact group navigation on mobile. Keep detailed configuration in administrator tools. Turn Help into short task sections: Start a garden, Edit beds, Plan planting, Record completed work, Sharing, and Shortcuts. Add contextual empty-state links to the relevant task.

## Recommended implementation sequence

1. Add deletion recovery; correct mobile selection/panel state; expose desktop object actions.
2. Standardize labels and save state; add direct Catalogue navigation; simplify mobile toolbars.
3. Reorganize inspectors and history; introduce stable area names and keyboard geometry editing.
4. Refine catalogue browsing and task-oriented help after the main workflows are stable.

## Broader validation checklist

- Desktop at 1280 × 800 and 1440 × 900; tablets around the `sm` and `lg` transitions.
- Phones at 320 × 568 and 390 × 844; landscape; browser text zoom and 200% desktop zoom.
- Long garden/bed/crop names, duplicate crops, many beds, populated mulch layers, empty catalogue, and shared gardens.
- Garden → bed → area → back; open/close controls; switching gardens/catalogue with pending edits.
- On-screen keyboard with lower inspector fields, safe-area insets, and internally scrolling sheets.
- Keyboard-only editing, focus return after dialogs/navigation, screen-reader object selection, light/dark contrast, and target sizes in calendars and layer controls.
- Save failures, conflicts, destructive actions, explicit completed-work recording, and returning from history to the current plan.

The completed browser and automated checks are recorded above. The remaining checklist includes cases not exercised in this pass; it is not a claim of full accessibility or physical-device certification.


## Navigation and calendar follow-up — 19 November 2026

Added shared app destinations across garden, bed, area, catalogue and calendar
screens, preserving the mounted editor and suspending its shortcuts while hidden.
Catalogue now has visible group and section navigation, retained searches, and
restored list position after details. Unsaved forms use their actual validated save
operation for Save and leave; failures keep the draft open. Hidden preserved fields
receive separate IDs so their labels do not shadow the active screen.

Growing calendar now shares monthly/annual browsing across catalogue and garden
entry points, with named month selectors, activity/search/garden filters and explicit
regional coverage. Repeated range notes are removed and contiguous windows normalized
without changing active months. See catalogue documentation for the verified live
cleanup counts and restricted rollback backup.

Browser review uses a local fixture with the real catalogue/calendar components and
built stylesheet; it does not change garden records. Automated checks cover navigation
recovery, read-only access, winter windows, cultivar inheritance, filtering, retry,
repeat-safe migration and normalization, and both save RPCs. Physical-device keyboard
and assistive-technology validation remain outside browser emulation.

Final validation: all 341 automated tests and the production build passed; `git diff
--check` was clean. The local browser fixture had no horizontal overflow at
320×568, 390×844, 844×390, 768×1024, and 1280×800 in light mode, or 1440×900 in
dark mode. Selected calendar controls use dark text on the pale light-mode fill
and light text on the dark-mode fill. The existing large-bundle build warning remains.


## Navigation simplification — 23 November 2026

Removed the separate app-navigation row. The existing screen header now contains
one Menu control for app destinations. Catalogue has Plants and Mulch groups;
Growing calendar appears only in the app menu, with its administrator configuration
inside Calendar settings. Garden More contains garden tools rather than repeated
app destinations. History and Garden settings are reached through More.

Bed selection replaces Summary with Edit bed in the same four-action garden toolbar.
It opens no inspector and adds no row. Undo stays in the header, disabled when its
history is exhausted. Summary remains available in More while a bed is selected.

All 342 tests and the production build pass. Browser verification used the real
garden canvas with local repository fixtures and the built stylesheet. Selecting
a bed preserved the canvas at 390×723 px in a 390×844 viewport, 320×447 px at
320×568, and 1440×779 px at 1440×900. The toolbar stayed 65 px high; each view had
one header and no horizontal overflow. No database changes were needed for this
navigation correction.


## P1 usability — 23 November 2026

- Catalogue starts at Families, followed by Crops, Cultivars and Seed mixtures. Lists use compact Edit/View actions; details retain the same top Back action and unsaved-change protection.
- Saves keep forms open with updated revisions. Crop and mixture refresh failures preserve drafts and offer a read-only retry rather than repeating a committed write.
- Bed and area selection no longer enables resize handles. Explicit Resize mode stays active until Done, selection changes or navigation; newly added beds/areas start in this mode. Movement and numeric geometry editing retain their existing rules.
- All three editor headers expose Undo and Redo, using compact labelled icons on phones.
- The connected catalogue was audited with read-only queries; local/CATALOGUE_AUDIT.md records findings. No catalogue data or schemas were changed.

Validation: all 352 tests and the production build passed. Browser checks used the real components with isolated local repository fixtures at 320×568, 390×844 and 1440×900, including resize, Undo/Redo, focused-area and catalogue flows. No horizontal overflow was observed; phone headers use compact controls and save status. The existing large-bundle warning remains. Live catalogue writes and physical touch-device behavior were not exercised.

## Catalogue consistency — 24 November 2026

Plants, mulch materials and category configuration now share compact catalogue rows with aligned inline actions. Mulch details use the same Previous/Next controls, record heading and top Back action as plant details. Navigation stays within the filtered category, preserves Save/Discard/Stay protection, and restores list search, scroll and focus. Living mulch remains read-only.

Validation: all 369 tests and the production build pass. Browser fixtures checked compact rows and detail navigation at 320×568, 390×844 and 1440×900, plus category configuration and plant rows, with no horizontal overflow or console errors. No database changes were needed.

## Bed canvas update — 24 November 2026

- Focus area and desktop double-click zoom within the bed page, retaining neighbours.
- Wheel/pinch zoom, two-finger pan, explicit Pan mode and Fit bed affect only the view.
- Areas, bed Settings and Advice are separate panels; advice keeps its planning date.
- Fixed headers and selection controls, overlay feedback and a phone inspector overlay keep the canvas stable.
- Phone Focus area closes the inspector; Edit selected area reopens it without moving the drawing.

Validation: all 389 tests and the production build passed. Real Konva browser
checks covered wheel/pinch anchoring, pan, selection, panels, failed-save feedback,
and 320×568, 390×844, 844×390 and 1440×900 layouts. Canvas bounds and camera stayed
stable across selection and feedback; no horizontal overflow was observed.
Touch events were simulated; physical-device gestures and native keyboards remain
unverified. The existing large-bundle build warning remains.

## Shared headers and Back navigation — 24 November 2026

- Page and dialog headers share a 72 px height, 16 px title, fixed text alignment and reserved subtitle/status line.
- Back uses a 44 px chevron with a destination label and tooltip; long labels no longer move the title.
- Catalogue and Calendar details use the header Back action; nested configuration restores its parent action.
- Workspace Back unwinds Catalogue/Calendar visits while preserving the garden draft and unsaved-change checks.
- Garden creation returns to its picker list through the dialog header. Close remains a separate action.
- Phone headers prioritize save status over secondary measurements.

Validation: all 393 tests and the production build passed. Browser checks at
320×568, 390×844 and 1440×900 measured identical header height, title font/line
height and title coordinates across garden, bed, bed history, catalogue, calendar,
details, dialogs and the initial gardens screen. Nested Back, Stay/Discard,
validation and failed-save feedback retained the same layout. No horizontal
overflow or browser console errors were observed. The existing bundle-size
build warning remains.

## Garden bed resizing — 24 November 2026

- Removed the Beds list and replaced its toolbar button with Resize bed / Done resizing.
- Edit bed stays available during resizing; Resize is disabled until an editable bed is selected.
- Mouse and touch handles keep their live preview and save on release, including rotated phone views.
- Attempts to crop planted/mulched areas or overlap beds explain the limit and retain the last valid size. The explanation remains after releasing the handle.
- Keyboard users can focus the drawing, select beds with arrow keys, edit with Enter and deselect with Escape.

Validation: 396 tests and the production build passed, with targeted resize tests
also rerun after checking blocked drops. Browser checks exercised mouse/touch
resizing at 320×568 and 1440×900, a 90-degree garden view, autosave and stable
canvas dimensions. Touch events were simulated; physical-device testing remains
unverified. The existing bundle-size warning remains.

## Nested resizing and contextual actions — 24 November 2026

- Garden handles and bed size settings scale all inner area edges on the 5 cm grid, preserving shared boundaries and gaps.
- Plant snapshots, IDs, chosen row counts, spacing, sowing density and mulch layers remain attached. Counts and quantities follow resized bounds.
- Shrinking stops before plant minimum clearances or chosen rows fail. Bed and area changes save together; Undo/Redo restores the complete geometry.
- No selection: Add bed, Summary, History, More. Garden More contains Garden settings and Paste bed.
- Bed selected: Edit bed, Resize bed, Bed summary, More. Bed More contains Copy bed and Delete bed.
- Help and Account are in the top-right Menu alongside workspace destinations. Sign-out protects incomplete drafts and waits for queued saves.

Validation: all 403 tests and the production build passed. Browser checks at
320×568, 390×844 and 1440×900 covered live mouse/touch scaling of adjacent areas,
minimum-space rejection, numeric resize, Undo/Redo, scoped menus and Help.
No horizontal overflow or console errors were observed. Touch events were
simulated; physical-device checks remain unverified. The existing large-bundle
warning remains.

## Popup headers and Catalogue entry — 24 November 2026

- Light/dark controls remain in main page headers and are removed from all shared popups.
- Popup titles use 16 px semibold text, align with the content padding and wrap without truncation. Back occupies space only when available; Close stays on the right.
- Popup headers start at 72 px and grow for long titles; main page header height stays fixed.
- Catalogue is accessible only through the top-right Menu. Garden selection now contains only its list and creation flow.
- The initial gardens screen also has the top-right Menu for Catalogue, Help and Account. Growing calendar now belongs to garden More (see below).

Validation: all 403 tests and the production build passed. Browser checks at
320×568, 390×844 and 1440×900 covered garden selection, creation, Menu-only
Catalogue entry and long popup titles in both themes. No clipped titles,
horizontal overflow, popup theme controls or browser console errors were
observed. The existing large-bundle build warning remains.

## Popup copy cleanup — 24 November 2026

- Removed repeated Add bed, Garden dimensions, Garden location and Bed actions headings inside popups.
- Bed summary keeps its name in the header, with dimensions and quantities in the content. Removed generic summary footers and repeated per-sowing bed names.
- Shortened size hints while retaining field labels, validation, permissions and confirmation details.
- Garden creation now changes the popup title to Create garden and restores Your gardens on Back. The app popup is titled Menu.
- Rechecked header-only theme controls and Menu-only Catalogue access; neither appears in garden selection.

Validation: the full 403-test suite passed, then all 116 affected tests and the
production build passed after the final copy changes. Phone and desktop browser
checks found one task heading per reviewed popup, wrapped long titles, no
horizontal overflow and no console errors. The existing bundle warning remains.

## Garden calendar and deletion — 24 November 2026

- Garden More opens Growing calendar for the current garden’s location; the top-right Menu no longer lists it.
- The calendar header identifies the garden and location. Changing gardens resets its context.
- Bed More uses the bed name and dimensions as its title, without repeating them in the content.
- Owners can confirm Delete garden. It waits for pending saves, rejects stale revisions, and allows retry after failures.
- Successful deletion clears the editor/calendar and offers remaining gardens or creation. Related history, activities and sharing cascade; other gardens remain intact.

Validation: all 412 tests and the production build passed. Isolated database tests
cover owner permissions, revision conflicts, cascading deletion and retries.
Browser checks at 320×568 and 1440×900 cover contextual menus, confirmation,
cancellation, failure retry, pending controls and the remaining-garden picker.
No horizontal overflow or console errors were observed. The existing bundle
warning remains. Migration 032 is tested locally but **not applied** to the
connected database: automatic approval review requires explicit live database
authorization. No live gardens were deleted.

## Centered dialogs and garden navigation — 24 November 2026

- Dialog titles are centered with equal Back/Close space; long titles wrap and grow the header.
- Garden and bed editors share Zoom in/out, Fit, Focus and Pan controls.
- Garden navigation supports pointer-anchored wheel zoom, pinch/two-finger pan and mouse/one-finger Pan.
- Pan and bed Resize are exclusive. Pinching cancels an active geometry drag without committing it.
- Selection and resize controls keep the canvas bounds stable; view changes neither save geometry nor enter Undo history. Historical garden views retain navigation without editing.

Validation: all 415 tests, the production build and `git diff --check` passed.
Tests cover both rotations, focus/fit, viewport changes, interrupted drags and
mode switching. Browser checks at 320×568 and 1440×900 verify zoom, wheel,
pinch and pan without saves, stable canvas bounds, centered titles with/without
Back, long-title wrapping, and the bed editor’s shared controls. No horizontal
overflow or console errors were observed. Touch checks are simulated; physical
devices remain unverified. The existing large-bundle warning remains.

## Planting bounds and minimum clearances — 24 November 2026

- Area position & size edits the bed-relative rectangle; Plant clearances edits minimum distances inside it.
- Top/Right/Bottom/Left use the original bed axes, 5 cm steps and the saved crop minimum. Actual gaps appear alongside the fields and in Summary; Reset restores the saved default.
- Manual row counts are retained while gaps compress; automatic rows and plant counts use the remaining space. Unfitting or invalid overrides remain unsaved drafts.
- Moves, area/bed resizing, copy/paste, crop selection and Undo preserve custom minimums in cm. Larger crop minimums require correcting overrides or Reset.
- Client/server validation agrees; existing gardens, revisions and history remain unchanged by migration 033. The duplicated saved-mixture option is removed.

Validation: all 429 tests and the production build passed. Model/database tests
cover asymmetric minimums, both directions, defaults, malformed inputs, resize
limits, round trips and permissions. Browser checks at 320×568, 390×844 and
1440×900 verify real canvas updates, unchanged canvas bounds, actual values,
invalid-draft protection, Undo/Redo, Reset and numeric bed resize limits. No
horizontal overflow or console errors were observed. The 79 editor tests and
build passed after shortening the phone copy. Physical phones remain unverified;
the existing bundle warning remains. Migration 033 is prepared and locally
tested, **not applied** to live Supabase pending explicit approval.

## Live minimum-clearance rollout — 24 November 2026

- Applied migration 033 to the connected live Supabase database after explicit approval.
- Preflight source hashes matched the expected prior validators; installed hashes match the migration exactly.
- All 13 read-only smoke cases passed, both as the database administrator and under the authenticated role: defaults, asymmetric edges, both directions, invalid values, capacity limits and legacy geometry.
- Verified authenticated execution, anonymous denial, immutable validators and empty search paths.
- Garden, history, revision, activity and membership counts/content fingerprints were unchanged. No real gardens were edited or deleted.
- Migration 032 is independent and was authorized only if needed. It was not required by 033 and remains unapplied; garden deletion is still pending deployment.

## Live garden-deletion rollout — 24 November 2026

- Applied migration 032 after explicit authorization; the existing Delete garden action now has its live RPC.
- Verified the function source matches the migration, SECURITY DEFINER uses an empty search path, authenticated callers can execute, and anonymous/direct table deletion remain blocked.
- Used a disposable fixture inside a rolled-back subtransaction to verify non-owner/missing-auth denial, stale and invalid revisions, owner deletion, idempotent retry and cascading cleanup of sharing, activities, history and revisions.
- Rolled back every fixture change. Existing garden/history/revision/activity/membership counts and content fingerprints were unchanged. No existing garden was deleted.
- Migration 033’s clearance validator remains unchanged. Both database rollout tasks are complete.

## Automatic own-family rotation — 24 November 2026

- Crop/cultivar Avoid after includes a read-only Automatic family fallback; an existing family rule appears only once.
- Explicit family, crop and cultivar exceptions retain the existing specificity and caution-first tie rules. Same-family favourable entries are labelled as exceptions.
- The fallback follows draft and saved family selection, including Discard, without entering the editable rows or generating rotation writes.
- Suggestions uses the same fallback for recorded same-family predecessors. Interval warnings suppress duplicate automatic cautions for the same observation; explicit explanations and independent interval warnings remain visible.
- Historical family snapshots and stored rules are unchanged. No database migration or backfill is needed.

Validation: all 443 tests and the production build passed; `git diff --check`
was clean. Tests cover reader/admin crop/cultivar views, defaults, existing
rules, exception save/removal, inheritance, family changes, write-free browsing,
rule precedence, history preservation, interval warnings and duplicate advice.
Browser checks at 320×568, 390×844 and 1440×900 in light/dark themes confirm
wrapping, no horizontal overflow, calculated family changes, exceptions,
cultivar inheritance and reader access. Suggestions browser checks confirm the
family caution, favourable exception and independent interval warning without
saves. No console errors were observed. The existing bundle warning remains.


## Dated activity planning and combined calendar — 24 November 2026

- Garden More now opens Calendar, with Work first and Seasonal guidance separate.
- Work combines dated metadata-only tasks and completed records; filters cover current, selected or all accessible gardens, bed, activity, status and dates.
- Planned work supports editing, rescheduling and cancellation. Overdue follows local date-only semantics without mutating tasks.
- Completion reviews the latest saved garden/bed and asks for actual date plus explicit confirmation. One transaction records history and completes the task; it applies no proposed layout.
- Completed tasks and their linked events appear once. Corrections supply current metadata; deleting history retains explicit task completion.
- Open history uses the existing inspector and historical correction tools without switching or replacing the current editable garden draft. Back preserves filters.
- Seasonal guidance remains tied to the active garden region. Plan an activity prefills a task without saving or completing it.
- Failed drafts, pending requests, conflicts and retries have explicit handling. Navigation offers Save/Discard/Stay; a conflict requires reload and completion confirmation again.
- Migration 034 is prepared and tested locally; live deployment awaits explicit approval. Existing pending work copies remain hidden and are not imported.

Validation: 467 tests and production build passed. Browser fixtures with real UI
and canvas plus fake repositories passed at 320×568, 390×844 and 1440×900,
including light/dark themes, dirty navigation, task planning/cancellation,
explicit completion, deduplication, history inspection and regional guidance.
No horizontal overflow or console errors were observed. No live data was changed.
Physical-device checks and the existing bundle warning remain open.


## Shared calendar in garden and bed editors — 24 November 2026

- Calendar replaces History in both toolbars and remains available with a selected bed. Garden More no longer repeats the full-calendar destination.
- Both editors and full-page history inspection reuse the Work month grid and agenda. The previous history calendar, list and record-arrow bar have been removed.
- Garden shows all garden/bed records; Bed shows its own records and garden-wide checkpoints. Selecting a day previews the latest completed state on or before it. The agenda selects exact same-day records.
- Month arrows only change months. Return to current plan restores editing; Close calendar also restores the previous controls.
- Bed preview stays within the existing editor. Its current drawing, settings, incomplete fields, selection and undo state stay mounted and independent of recorded snapshots.
- Desktop keeps Calendar on the right. Phones use an expandable bottom panel over the drawing, with the month grid before secondary controls. Expanding/collapsing leaves canvas dimensions unchanged.
- Open full calendar recalls cross-garden Work and regional Seasonal guidance from either editor; Back retains the draft and panel context.
- Task planning defaults to the current bed and does not switch the drawing or record completion.
- Completed-history metadata has a paginated fallback when dated-task storage is missing. Missing storage disables dated planning with a message; authorization and network errors are still reported.
- Migration 034 remains unapplied at the user’s request. No live database action was taken.

Validation: 470 tests and production build passed. Targeted editor tests passed
after the mobile panel refinements. Browser checks at 320×568, 390×844 and
1440×900 in light/dark themes verified the shared panel, exact/day selection,
read-only previews, current-plan return, draft preservation, expanded phone
layout, full-calendar recall and the state before migration 034. Additional
fixture checks verified task planning/editing from the bed panel without plan
writes. No horizontal overflow or console errors were observed. Physical phones
and the existing production bundle warning remain open.


## Live dated-task rollout — 24 November 2026

- Applied migration 034 to live Supabase after explicit authorization, in one atomic statement; PostgREST schema reload was notified.
- Both task RPC source bodies match the migration. SECURITY DEFINER routines use empty search paths; authenticated execution is enabled and anonymous execution denied.
- Confirmed task RLS, authenticated read-only table access, direct-write denial and the security-invoker calendar metadata view.
- Disposable fixtures exercised owner/editor task planning, rescheduling, cancellation, confirmed bed/garden completion, revision conflicts, idempotent retries and metadata-only plan preservation.
- Verified outsider/anonymous denial, cross-garden retarget denial, revoked-editor denial, linked-history deletion retaining completion and garden deletion cascading tasks.
- Rolled back all fixture accounts, gardens, sharing, tasks and history. Final task count is zero; no fixture users or gardens remain. The retired separate-planning endpoint remains disabled.
- Existing history, revisions, activities, sharing and account fingerprints match the pre-migration baseline. The current garden was updated during the broader rollout window (updated_at 14:57:59 UTC); its live state was retained. Exact garden and other data fingerprints match before and after the final rolled-back verification run.
- Dated task storage is now available. Refresh Calendar to replace its pre-rollout availability state. No application code changed during deployment.

## Calendar panel and centered controls — 24 November 2026

- Calendar occupies the regular editor layout: right sidebar on desktop, stacked panel on phones. Removed its floating overlay and Expand/Collapse controls.
- Calendar uses the same desktop widths as the bed inspector. Selecting Areas, Settings, Summary, Advice, Add area or Edit selected area switches away from Calendar; only the active tool is highlighted.
- The garden selector is centered in the header with balanced side columns. Myco and Undo/Redo sit on the left; theme and Menu sit on the right. Selector text is centered and long names truncate.
- Shared garden/bed zoom controls are centered within the canvas width, including with a sidebar open. Bed resize actions remain separate.

Validation: production build and 101 targeted editor/history tests passed;
updated tool-switching assertions also passed. Browser checks at 320, 390, 640,
1024 and 1440 px verified centered selector/zoom bounds, a static Calendar panel
without canvas overlap, exclusive tool switching, no horizontal overflow and no
console errors. Documentation and local TODO reflect the layout change. Live
migration 034 remains applied; no database changes were needed.


## Reviewed work checklists and calendar commands — 24 November 2026

- New planned tasks generate a reviewable recap and checklist from the selected saved scope. Instructions include saved row/broadcast quantities and ordered mulch layers; care/harvest wording requires checking conditions rather than assuming treatment or readiness.
- Recap and instructions support editing, adding/removing items and checked progress. Saving progress keeps the task planned. Completion remains explicit and preserves unchecked items.
- Untouched suggestions follow scope/activity changes; edited instructions remain intact. Regeneration reloads the latest saved plan and asks before replacing text or progress.
- Agenda cards and completion review display the saved work. History correction/removal does not rewrite task instructions.
- Editor Calendar has one command row for planning, filters, refresh and full-calendar navigation. The month grid has a compact month heading and 44 px day targets. Activities shows the readable range and result count.
- Task edit/complete actions are separated from cancellation options. Manual recording/past-record tools and selected-record correction/deletion occupy distinct sections. The regular editor panel, centered controls and hidden bed-calendar Close action are retained.
- Migration 035 is prepared and locally tested, awaiting live approval. Existing title/notes planning works through legacy columns/endpoints before rollout; older clients preserve checklist fields after rollout. Migration 034 remains applied.

Validation: 483 tests and production build passed. Tests include migration/backfill
preservation, real RPC authorization and retry behavior, malformed checklist
rejection, generated quantities, edited/checked work preservation, explicit
replacement, failed regeneration, completion separation and pre-rollout fallback.
Browser fixtures passed at 320×568, 390×844, 1024×900 and 1440×900 in light/dark
themes, with generated/editable steps, progress, regeneration confirmation,
explicit completion, separated commands and full-calendar return. No horizontal
overflow, console errors or garden writes occurred. Live migration 035 has not
been applied. Physical phone verification and the existing bundle warning remain open.


## Garden header action placement — 24 November 2026

Restored Undo/Redo to the right beside theme and Menu. Desktop retains a centered
garden selector; phone layouts keep its text centered within the available space.
Build and 92 editor/keyboard tests passed. Browser checks at 320, 390, 640 and
1440 px confirmed action order and no header overflow.


## Live checklist rollout — 24 November 2026

- Applied migration 035 to live Supabase in one atomic statement after explicit approval; notified PostgREST to reload its schema.
- Verified the checklist save RPC and private validator match their migration source and use empty search paths. Authenticated callers can execute the save RPC; anonymous callers cannot. The validator remains private.
- Confirmed required recap/checklist columns and empty defaults, existing task RLS, read permissions, direct-write denial and security-invoker calendar view.
- Rolled-back owner/editor fixtures verified atomic work saves, rescheduling/progress without completion, payload-aware retries, stale revision rejection and malformed/oversized checklist rejection.
- Confirmed legacy edits/cancellation preserve instructions; explicit completion and its retries preserve checked/unchecked state. History deletion retains work; completed instructions cannot be rewritten through the save RPC.
- Verified outsider/anonymous/revoked-editor denial, cross-garden retarget denial, private-validator denial and garden deletion cascading task instructions.
- Both legacy task RPC source fingerprints remain unchanged. Existing garden, task metadata, sharing, history, revisions, activity and account fingerprints match the pre-migration baseline.
- All temporary users, gardens, sharing, tasks and history were rolled back. No verification fixtures remain. Work checklist storage is enabled; refresh Calendar to reload its availability.
