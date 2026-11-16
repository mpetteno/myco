# Myco

A garden layout app built with Vite, React, TypeScript, react-konva and Tailwind CSS.

## Development

Use a Node.js version supported by Vite (Node 22.12+ or a newer supported release).

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
- `src/features/garden`: garden screen, dimensions, grid and layout state.
- `src/features/beds`: bed forms, list, drawing and placement rules.
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
gardens or create another one. Use **More → Rename garden** to rename it.
Use **More → Garden size** to change dimensions. Dimensions must be at
least 5 cm and round to the nearest 5 cm when applied. You can update them with
the same form, which opens with the current dimensions and closes after a successful save.
The empty green garden shows a repeating 5 cm grid and fits entirely into the
drawing area, preserving its proportions. The view automatically chooses between
0° and 90° to use the largest possible scale for the available screen space.

Use **Add bed** to open the form for a rectangular bed with a name, width and length.
Bed dimensions must be at least 5 cm and snap to the nearest 5 cm. New beds occupy
the first free space on the grid, scanning from the top left without overlapping.
If no space fits, the form asks for smaller dimensions or a larger garden.
Use **Beds** to browse the bed list, or select a bed in the drawing and choose
**Edit bed** to edit its name and dimensions. Forms close after a successful save.
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
existing 5 cm grid. Numeric position inputs are not planned; positioning uses
the mouse or touch.

Select a bed in the drawing or list to show its eight resize handles. Drag an edge
handle to change one dimension, or a corner handle to change both. The opposite
edge or corner stays fixed. Resizing snaps to 5 cm, stops at the garden boundary,
and keeps a minimum width and length of 5 cm. Overlapping attempts keep the last
valid size. Handles have enlarged touch targets, and dropping a handle updates
the bed list and size fields. Each bed's name follows its longer side: horizontal
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
editing. On small screens and touch devices, **More** provides touch controls
to edit, copy, paste or delete the selected bed. Paste remains available after
deselecting a bed, provided a copy exists. This clipboard belongs to the app
and clears on reload.

Press **Delete** or **Backspace** outside text fields to remove the selected bed
and clear its selection. With no selected bed, these keys do nothing to the
garden. Input fields, text areas and editable text retain their normal typing
behaviour. A copied bed remains available to paste even after deleting its source.
Editor keyboard shortcuts are suspended while a modal panel is open.

The screen adapts to desktop and phone sizes and follows the device's light/dark
setting. The garden starts without beds.
The drawing uses the full screen width and the space between the compact Myco
top bar and the bottom toolbar, without a desktop width cap or an action-status
row. The garden is centred and uniformly
scaled to fit the entire drawing area, with a small margin for resize handles.
Its longer dimension follows the longer dimension of the available view: usually
horizontal on desktop and vertical on a portrait phone. Turning the screen
recalculates the view without changing garden measurements or bed positions.
Distance labels stay upright and bed labels follow their bed’s displayed longer
side. Garden settings are available through **More → Garden size**.
The bed list, forms and help open
only when requested. Selecting a bed keeps the canvas visible and does not open
its form automatically. Panels appear as bottom sheets on phones and centred
dialogs on larger screens. They support Close, backdrop dismissal and Escape.

The viewport includes safe-area padding for notches and home indicators. Panels
follow the visual viewport and scroll internally so inputs remain accessible
when the on-screen keyboard reduces the visible area. This is browser layout
support for future Capacitor packaging; no Capacitor project or native build is
configured yet. Native keyboard and safe-area behaviour still need verification
in the eventual Android/iOS shells.

All garden geometry uses centimetres; only the canvas rendering boundary uses
screen pixels to fit the garden to its container.

Supabase stores each user's gardens, including names, dimensions and beds.
Edits save automatically after form submissions and finished drags. The dot by
the garden name indicates saved or pending changes; failures offer recovery.
Switching gardens and signing out wait for pending saves. Reloading opens the
most recently updated garden. Row Level Security restricts access to the owner
and added editors. Native Capacitor packaging remains an upcoming step.
See [saved gardens](docs/saved-gardens.md) for the schema, failure handling and tests.

Use **More → Sharing** to add an editor by their confirmed account email, view
editors or remove access. Everyone with access can edit the garden's name,
dimensions and beds; only its owner manages sharing. Shared gardens appear in
the recipient's garden picker, marked **Shared · Can edit**. The picker refreshes
when opened and offers **Refresh gardens**. Sharing sends no email and requires
an existing account. See [sharing](docs/sharing.md) for access and collaboration details.

See [deployment preparation](docs/deployment.md) for Supabase configuration and
the recommended Cloudflare Pages hosting settings.

Setup references: [Tailwind with Vite](https://tailwindcss.com/docs/installation/using-vite)
and [react-konva](https://konvajs.org/docs/react/index.html).
Dragging follows [Konva's drag and drop guidance](https://konvajs.org/docs/react/Drag_And_Drop.html).
Mobile layout uses [CSS environment variables](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env)
and [native modal dialogs](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog).
