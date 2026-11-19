import { useLayoutEffect, useRef } from 'react';
// Lists keep their filters in their parent; restore the scroll and trigger after a detail reload.
export function useDetailScroll(ready: boolean) {
  const memory = useRef<{ scroller: Element; top: number; trigger: HTMLElement | null; restore: boolean } | undefined>(undefined);
  useLayoutEffect(() => {
    const saved = memory.current;
    if (ready && saved?.restore) {
      saved.scroller.scrollTop = saved.top;
      if (saved.trigger?.isConnected) saved.trigger.focus({ preventScroll: true });
      saved.restore = false;
    }
  });
  return {
    remember() {
      const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const scroller = trigger?.closest('[data-page-scroll]');
      if (scroller) memory.current = { scroller, top: scroller.scrollTop, trigger, restore: false };
    },
    restore() { if (memory.current) memory.current.restore = true; },
  };
}
