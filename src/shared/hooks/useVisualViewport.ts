import { useEffect, useState } from 'react';

function readViewport() {
  return {
    heightPx: window.visualViewport?.height ?? window.innerHeight,
    topPx: window.visualViewport?.offsetTop ?? 0,
  };
}

export function useVisualViewport() {
  const [viewport, setViewport] = useState(readViewport);
  useEffect(() => {
    const update = () => setViewport(readViewport());
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return viewport;
}
