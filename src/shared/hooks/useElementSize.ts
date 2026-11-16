import { useEffect, useRef, useState } from 'react';

// Only the rendering boundary uses screen pixels; garden geometry stays in cm.
export function useElementSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [sizePx, setSizePx] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSizePx({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, sizePx };
}
