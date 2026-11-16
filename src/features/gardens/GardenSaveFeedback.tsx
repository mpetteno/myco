import { useState } from 'react';
import type { GardenSaveStatus } from './GardenSaveQueue';
import { gardenStorageError } from './gardenErrors';
import { Button } from '../../shared/ui/Button';

type GardenSaveFeedbackProps = {
  status: GardenSaveStatus;
  onRetry: () => Promise<string | null>;
  onReload: () => Promise<void>;
  onDiscardChanges: () => void;
};

export function GardenSaveFeedback({ status, onRetry, onReload, onDiscardChanges }: GardenSaveFeedbackProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (status.state !== 'error') return null;

  async function act(reload: boolean) {
    setPending(true); setError('');
    try { if (reload) await onReload(); else setError(await onRetry() ?? ''); }
    catch (problem) { setError(gardenStorageError(problem).message); }
    finally { setPending(false); }
  }
  return (
    <aside role="alert" className="shrink-0 space-y-2 border-b border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
      <p>{error || status.message} Your current changes are not saved.</p>
      <div className="flex flex-wrap gap-2">
        {!status.conflict && <Button variant="secondary" disabled={pending} onClick={() => void act(false)}>Retry save</Button>}
        {status.conflict && <Button variant="secondary" disabled={pending} onClick={() => void act(true)}>Discard changes and reload saved garden</Button>}
        <Button variant="secondary" disabled={pending} onClick={onDiscardChanges}>Discard changes and reload gardens</Button>
      </div>
    </aside>
  );
}
