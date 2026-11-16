export function isTextEditingEvent(event: KeyboardEvent) {
  return [event.target, ...event.composedPath()].some((target) =>
    target instanceof Element
    && target.closest('input, textarea, select, [contenteditable], [role="textbox"]'),
  );
}
