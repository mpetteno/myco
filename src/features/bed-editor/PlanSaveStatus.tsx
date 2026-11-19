import type { GardenSaveStatus } from '../gardens/GardenSaveQueue';

export function PlanSaveStatus({ status, dirty, compact = false }: { status: GardenSaveStatus; dirty: boolean; compact?: boolean }) {
  const label = status.state === 'error' ? 'Save failed' : dirty ? 'Changes need attention'
    : status.state === 'saving' ? 'Saving…' : compact ? 'Saved' : 'All changes saved';
  return <span role="status" className="text-xs text-stone-600 dark:text-stone-400">{label}</span>;
}
