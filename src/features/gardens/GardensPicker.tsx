import { useEffect, useRef, useState } from 'react';
import { Button } from '../../shared/ui/Button';
import type { GardenDocument, GardenSummary } from './gardenDocument';
import { GardenCreateForm } from './GardenCreateForm';
import { gardenStorageError } from './gardenErrors';

type GardensPickerProps = {
  gardens: GardenSummary[];
  currentId?: string;
  onChoose: (id: string) => Promise<void>;
  onCreate: (document: GardenDocument) => Promise<void>;
  onPendingChange: (pending: boolean) => void;
  userId: string;
  onRefresh: () => Promise<void>;
};

export function GardensPicker({ gardens, currentId, onChoose, onCreate, onPendingChange, userId, onRefresh }: GardensPickerProps) {
  const [creating, setCreating] = useState(gardens.length === 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const [refreshing, setRefreshing] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setRefreshing(true); setError('');
    void onRefresh().catch((problem) => { if (alive) setError(gardenStorageError(problem).message); })
      .finally(() => { if (alive) setRefreshing(false); });
    return () => { alive = false; };
  }, [onRefresh, attempt]);
  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true; setPending(true); onPendingChange(true); setError('');
    try { await action(); }
    finally { busy.current = false; setPending(false); onPendingChange(false); }
  }
  async function choose(id: string) {
    try { await run(() => onChoose(id)); }
    catch (problem) { setError(gardenStorageError(problem).message); }
  }
  if (refreshing) return <p role="status" className="text-sm">Refreshing gardens…</p>;
  if (creating) return (
    <div className="space-y-4">
      <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
      <GardenCreateForm onCreate={(document) => run(() => onCreate(document))} />
      {gardens.length > 0 && <Button variant="secondary" disabled={pending} onClick={() => setCreating(false)}>Back to gardens</Button>}
    </div>
  );
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {gardens.map((garden) => <li key={garden.id}>
          <button type="button" disabled={pending} aria-pressed={currentId === garden.id} onClick={() => void choose(garden.id)}
            className="min-h-14 w-full cursor-pointer rounded-lg border border-stone-300 p-3 text-left aria-pressed:border-green-600 focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-stone-700">
            <span className="block break-words font-medium">{garden.name}</span>
            <span className="block text-xs text-stone-600 dark:text-stone-400">{garden.dimensions.widthCm} × {garden.dimensions.lengthCm} cm · {garden.ownerId === userId ? 'Your garden' : 'Shared · Can edit'}</span>
          </button>
        </li>)}
      </ul>
      <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
      <Button disabled={pending} onClick={() => setCreating(true)}>Create another garden</Button>
      <Button variant="secondary" disabled={pending} onClick={() => setAttempt((value) => value + 1)}>Refresh gardens</Button>
    </div>
  );
}
