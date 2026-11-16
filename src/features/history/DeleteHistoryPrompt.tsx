import { Button } from '../../shared/ui/Button';
import { Sheet } from '../../shared/ui/Sheet';
import type { useGardenHistory } from './useGardenHistory';

export function DeleteHistoryPrompt({ history }: { history: ReturnType<typeof useGardenHistory> }) {
  if (!history.deleting) return null;
  return <Sheet title="Delete history entry?" dismissible={!history.saving} onClose={() => history.setDeleting(null)}>
    <div className="space-y-4">
      <p>Delete “{history.deleting.event.title}” from {history.deleting.event.date}?</p>
      <p className="text-sm text-stone-600 dark:text-stone-400">This removes only this entry from history. Later records and the autosaved plan stay unchanged.</p>
      {history.error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{history.error}</p>}
      <Button variant="danger" disabled={history.saving} onClick={() => void history.removeHistoryEntry()}>{history.saving ? 'Deleting…' : 'Delete entry'}</Button>
      <Button variant="secondary" disabled={history.saving} onClick={() => history.setDeleting(null)}>Cancel</Button>
    </div>
  </Sheet>;
}
