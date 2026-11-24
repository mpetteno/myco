import { useRef, useState } from 'react';
import { Sheet } from '../../shared/ui/Sheet';
import { Button } from '../../shared/ui/Button';
import { gardenStorageError } from './gardenErrors';

export function DeleteGardenDialog({ name, onDelete, onReload, onCancel }: { name: string; onDelete: () => Promise<void>; onReload?: () => Promise<void>; onCancel: () => void }) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [conflict, setConflict] = useState(false);
  async function run(reload = false) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { if (reload) await onReload?.(); else await onDelete(); }
    catch (problem) { const failure = gardenStorageError(problem); setError(failure.message); setConflict(failure.conflict); }
    finally { busy.current = false; setPending(false); }
  }
  return <Sheet title={`Delete “${name}”?`} dismissible={!pending} onClose={onCancel}>
    <div className="space-y-4">
      <p className="text-sm">Deletes this garden, all its beds, history and sharing access. This cannot be undone.</p>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {conflict && onReload && <Button variant="secondary" disabled={pending} onClick={() => void run(true)}>Reload garden</Button>}
      <Button variant="danger" disabled={pending || conflict} onClick={() => void run()}>{pending ? 'Deleting…' : 'Delete garden'}</Button>
      <Button variant="secondary" disabled={pending} onClick={onCancel}>Keep garden</Button>
    </div>
  </Sheet>;
}
