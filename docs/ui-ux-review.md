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
