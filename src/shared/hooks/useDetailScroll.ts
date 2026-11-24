import { useLayoutEffect, useRef } from 'react';
// Lists keep their filters in their parent; restore the scroll and trigger after a detail reload.
export function useDetailScroll(ready: boolean) {
  const memory = useRef<{ scroller: Element; top: number; trigger: HTMLElement | null; entryId?: string; restore: boolean } | undefined>(undefined);
  useLayoutEffect(() => {
    const saved = memory.current;
    if (ready && saved?.restore) {
      saved.restore = false;
      saved.scroller.scrollTop = saved.top;
      const trigger = saved.trigger?.isConnected ? saved.trigger : saved.entryId
        ? [...saved.scroller.querySelectorAll<HTMLElement>('[data-detail-entry]')].find((item) => item.dataset.detailEntry === saved.entryId) : null;
      const fallback = !trigger ? [...saved.scroller.querySelectorAll<HTMLElement>('input[type="search"]')].find((item) => !item.closest('[hidden], [inert]')) : null;
      (trigger ?? fallback)?.focus({ preventScroll: true });
    }
  });
  return {
    remember() {
      const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const scroller = trigger?.closest('[data-page-scroll]');
      if (scroller) memory.current = { scroller, top: scroller.scrollTop, trigger, entryId: trigger?.dataset.detailEntry, restore: false };
    },
    restore() { if (memory.current) memory.current.restore = true; },
  };
}
