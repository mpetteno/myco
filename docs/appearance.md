# Appearance

Use the sun/moon button in the top bar to switch between light and dark mode.
It is available in the garden, bed and focused area editors, history, sign-in
and catalogue/settings sheets. The choice is saved on this device, independently
of garden data. Before choosing, Myco follows the device's colour scheme;
a manual choice takes precedence over later system changes. Storage being
unavailable does not prevent toggling during the current session.

An early page script sets the palette before React loads to avoid a light flash
when reopening in dark mode. The root `data-theme` attribute controls Tailwind's
`dark:` variant and native input colour scheme. The shared theme subscription
updates Konva alongside the interface; selecting a palette does not edit a plan
or record history. Another tab's theme choice also updates this tab.

## Palette for review

The palette draws from oyster mushrooms, birch, bark, moss and chanterelles.
Colours are defined in `src/app/styles.css` (Tailwind scales) and
`src/features/appearance/canvasPalette.ts` (Konva). The early page script and
`theme.ts` also set the browser's theme colour to the relevant panel colour.

| Role | Light | Dark |
| --- | --- | --- |
| Page | Oyster cream `#f7f2e9` | Deep bark `#1b1814` |
| Panels | Warm ivory `#fffcf6` | Walnut `#28221c` |
| Main text | Walnut `#28221c` | Oyster `#eee4d5` |
| Secondary text | Wood grain `#675a4b` | Mushroom gill `#ab9a83` |
| Primary action | Forest moss `#365039` | Soft sage `#6f9568` |
| Garden | Pale moss `#d7dfc1` | Forest floor `#28372a` |
| Beds | Toasted wood `#9d704d` | Chestnut `#765338` |
| Bed editor soil | Honey wood `#d7b58d` | Umber `#60452f` |
| Border guides | Lichen blue `#38616d` | Pale lichen `#9ec5c7` |
| Neighbour guides | Chanterelle brown `#7d5427` | Ochre `#e1bd76` |
| Alignment guides | Mushroom mauve `#86536d` | Dusty rose `#d7a5bd` |
| Warnings | Clay `#923f32` | Mushroom cap `#e7aa96` |

Planting colours use muted botanical and mushroom accents, with brighter versions
on dark soil and small contrasting outlines. Mulch materials retain their stable
natural colours in both modes. Planned history remains cool blue and completed
history remains moss green, preserving their distinction.

Automated checks cover system preference, switching, persistence across app
initialization, cross-tab updates, unavailable storage, pre-React startup, text
contrast and preserving in-progress bed edits. Main text and primary/destructive
button colour pairs pass 4.5:1 contrast. Browser pixel and native device review
remain manual.
