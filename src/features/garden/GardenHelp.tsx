export function GardenHelp() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
      <p>Tap the garden name in the top bar to switch gardens or create another one. Use More → Rename garden to change its name, and More → Garden size to change its dimensions. Add bed creates a named bed in the first free space.</p>
      <p>Use More → Sharing to add or remove editors by their account email. Only the owner manages sharing; everyone with access can edit the garden. Recipients can refresh their garden list to find shared gardens.</p>
      <p>Drag a bed with your mouse or finger to move it. Tap to select it, then drag an edge or corner handle to resize. Everything snaps to 5 cm and stays inside the garden without overlaps.</p>
      <p>The entire garden fits on screen and keeps its proportions. The view turns by 90° when that makes the garden larger, aligning its longer side with the longer side of the drawing area. Measurements and bed positions keep their original garden axes.</p>
      <p>Blue measurements show garden-border gaps. Amber measurements show gaps to nearby beds. Dashed purple lines show aligned edges or centres.</p>
      <p>Use Edit bed for the selected bed’s name and size. More provides copy, paste and delete on touch screens.</p>
      <p>With the panels closed, Ctrl/Cmd+C copies and Ctrl/Cmd+V pastes. Delete or Backspace removes the selected bed. Typing in text fields is unaffected.</p>
      <p>Changes save automatically to your account after each edit or finished drag. The dot next to the garden name turns green when saved. If saving fails, keep the app open and use Retry save. Switching gardens and signing out wait for pending saves.</p>
      <p>Reopen a shared garden to load other people’s latest changes. If two people save from the same version, the later save asks you to reload so it cannot overwrite the other person’s work. If your access was removed, discard changes and reload your garden list.</p>
    </div>
  );
}
