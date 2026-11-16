import { useEffect, useState, useSyncExternalStore } from 'react';
import type { SavedGarden, GardenDocument } from './gardenDocument';
import { GardenSaveQueue } from './GardenSaveQueue';
import { saveGarden } from './gardenRepository';

export function useGardenPersistence(initial: SavedGarden, onSaved: (garden: SavedGarden) => void, save: (current: SavedGarden,document: GardenDocument) => Promise<SavedGarden> = saveGarden) {
  const [queue] = useState(() => new GardenSaveQueue(initial, save, onSaved));
  const status = useSyncExternalStore(queue.subscribe, queue.getSnapshot);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (queue.getSnapshot().state === 'saved') return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [queue]);

  async function beforeLeaving(): Promise<string | null> {
    try { await queue.flush(); return null; }
    catch { return queue.getSnapshot().message; }
  }

  return { status, enqueue: queue.enqueue, beforeLeaving, getCurrent: queue.getCurrent, adopt:queue.adopt };
}
