import { useCallback, useEffect, useState } from 'react';
import type { GardenDocument, GardenSummary, SavedGarden } from './gardenDocument';
import { createGarden, listGardens, loadGarden } from './gardenRepository';
import { gardenStorageError } from './gardenErrors';

export function useGardens(ownerId: string) {
  const [gardens, setGardens] = useState<GardenSummary[]>([]);
  const [active, setActive] = useState<SavedGarden | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [editorVersion, setEditorVersion] = useState(0);

  const remember = useCallback((garden: SavedGarden) => {
    setGardens((current) => current.some((item) => item.id === garden.id)
      ? current.map((item) => item.id === garden.id ? garden : item) : [...current, garden]);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    void (async () => {
      try {
        const list = await listGardens();
        const garden = list.length ? await loadGarden(list[0].id) : null;
        if (alive) { setGardens(list); setActive(garden); }
      } catch (problem) { if (alive) setError(gardenStorageError(problem).message); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [ownerId, attempt]);

  async function choose(id: string) {
    const garden = await loadGarden(id);
    remember(garden); setActive(garden); setEditorVersion((value) => value + 1);
  }
  async function create(document: GardenDocument) {
    const garden = await createGarden(ownerId, document);
    remember(garden); setActive(garden);
  }
  const refresh = useCallback(async () => { setGardens(await listGardens()); }, []);

  return { gardens, active, loading, error, editorVersion, remember, choose, create, refresh,
    retry: () => setAttempt((value) => value + 1) };
}
