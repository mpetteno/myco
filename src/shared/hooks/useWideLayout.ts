import { useEffect, useState } from 'react';

export function useWideLayout() {
  const [wide, setWide] = useState(() => window.matchMedia?.('(min-width: 1024px)').matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.('(min-width: 1024px)');
    if (!query) return;
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}
