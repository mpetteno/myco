import { Button } from '../../shared/ui/Button';

type BedLeavePromptProps = { onDiscard: () => void; onCancel: () => void; destination?: 'garden'|'history' };

export function BedLeavePrompt({ onDiscard, onCancel, destination='garden' }: BedLeavePromptProps) {
  return <section aria-label="Unapplied planting changes" className="shrink-0 space-y-2 border-b border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
    <p>Some planting or mulch changes could not be saved. Fix the highlighted fields or discard those changes before {destination === 'history' ? 'opening bed history' : 'returning to the garden'}. Your last valid plan is saved separately.</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <Button variant="secondary" onClick={onDiscard}>{destination === 'history' ? 'Discard and view history' : 'Discard and return'}</Button>
      <Button variant="secondary" onClick={onCancel}>Keep editing</Button>
    </div>
  </section>;
}
