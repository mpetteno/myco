import type { useGardenHistory } from './useGardenHistory';

const buttonClass = 'min-h-11 cursor-pointer rounded-lg px-2 text-sm focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-40';
export function GardenHistoryBar({ history, bedView = false }: { history: ReturnType<typeof useGardenHistory>; bedView?: boolean }) {
  if (!history.open) return null;
  const { previous, next } = history.neighbours;
  return <section aria-label="History navigation" className="shrink-0 border-b border-stone-200 bg-white px-3 dark:border-stone-800 dark:bg-stone-900">
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Previous event" title="Previous event" className={buttonClass} disabled={!previous || history.loading || history.saving} onClick={() => { if (previous) void history.select(previous); }}>←</button>
      <button type="button" aria-label="Open calendar and events" className={`${buttonClass} min-w-0 flex-1 truncate font-medium`} disabled={history.saving} onClick={() => { history.setRecording(false); history.setActivityForm(false); history.setInspector(!history.inspector); }}>
        {history.current ? 'Garden plan' : `${history.date} · ${history.selected?.title ?? 'No recorded layout'}`}
      </button>
      <button type="button" aria-label="Next event" title="Next event" className={buttonClass} disabled={!next || history.loading || history.saving} onClick={() => { if (next) void history.select(next); }}>→</button>
      <button type="button" className={buttonClass} disabled={history.saving} onClick={history.today}>Current plan</button>
      <button type="button" aria-label="Close history" className={buttonClass} disabled={history.saving} onClick={history.close}>✕</button>
    </div>
    {!history.current && <p className="pb-2 text-xs text-stone-600 dark:text-stone-400">{'Completed record · choose Edit history record to correct it'}{history.selected ? ` · “${history.selected.title}”${history.selected.date?` on ${history.selected.date}`:''}` : ''}. {bedView ? 'Back to bed returns to editing.' : 'Current plan returns to the editable garden.'}</p>}
    {history.loading && <p role="status" className="pb-2 text-sm">Loading history…</p>}
    {history.error && <p role="alert" className="pb-2 text-sm text-red-700 dark:text-red-400">{history.error}</p>}
    {history.message && <p role="status" className="pb-2 text-sm text-green-800 dark:text-green-400">{history.message}</p>}
  </section>;
}
