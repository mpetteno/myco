import { useCallback, useEffect, useRef, useState } from 'react';
import type { GardenDocument, GardenSummary, SavedGarden } from './gardenDocument';
import { createGarden, deleteGarden, listGardens, loadGarden } from './gardenRepository';
import { gardenStorageError } from './gardenErrors';

export function useGardens(ownerId: string) {
  const [gardens, setGardens] = useState<GardenSummary[]>([]);
  const [active, setActive] = useState<SavedGarden | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [editorVersion, setEditorVersion] = useState(0);
  const deleted = useRef(new Set<string>());

  const remember = useCallback((garden: SavedGarden) => {
    if (deleted.current.has(garden.id)) return;
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
        if (alive) { setGardens(list.filter((item) => !deleted.current.has(item.id))); setActive(garden && !deleted.current.has(garden.id) ? garden : null); }
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
  async function remove(garden: SavedGarden) {
    await deleteGarden(garden);
    deleted.current.add(garden.id);
    setGardens((current) => current.filter((item) => item.id !== garden.id));
    setActive((current) => current?.id === garden.id ? null : current);
    setEditorVersion((value) => value + 1);
  }
  const refresh = useCallback(async () => { setGardens((await listGardens()).filter((item) => !deleted.current.has(item.id))); }, []);

  return { gardens, active, loading, error, editorVersion, remember, choose, create, remove, refresh,
    retry: () => setAttempt((value) => value + 1) };
}
