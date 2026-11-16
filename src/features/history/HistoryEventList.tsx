import type { GardenEvent } from './gardenHistory';
import type { useGardenHistory } from './useGardenHistory';

export function HistoryEventList({ events,history }: { events:GardenEvent[];history:ReturnType<typeof useGardenHistory> }) {
  return <ul className="space-y-2">{[...events].reverse().map((event)=><li key={event.id}>
    <button type="button" aria-label={`View completed event: ${event.title}`}
      disabled={history.loading||history.saving} aria-pressed={!history.current&&history.selected?.id===event.id}
      onClick={()=>void history.select(event)} className="min-h-12 w-full cursor-pointer space-y-1 rounded-lg border border-stone-300 p-3 text-left aria-pressed:border-green-700 focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:border-stone-700 dark:aria-pressed:border-green-400">
      <span className="block break-words text-sm font-medium">{event.title}</span>
      <span className="block text-xs font-medium text-green-800 dark:text-green-400">
        Completed · {event.kind??'layout'}{event.eventVersion && event.eventVersion > 1 ? ' · corrected' : ''}
      </span>
      {event.bedId&&<span className="block text-xs text-stone-600 dark:text-stone-400">Bed: {history.getCurrent().beds.find((bed)=>bed.id===event.bedId)?.name??'No longer in the current garden'}</span>}
      {event.date&&<span className="block text-xs text-stone-600 dark:text-stone-400">{event.date}</span>}
      <span className="block text-xs text-stone-600 dark:text-stone-400">Recorded {new Date(event.recordedAt).toLocaleString()}</span>
      {event.plannedDate&&event.status!=='planned'&&<span className="block text-xs">Planned for {event.plannedDate}</span>}
      {event.notes&&<span className="block whitespace-pre-wrap break-words text-xs text-stone-600 dark:text-stone-400">{event.notes}</span>}
    </button>
  </li>)}</ul>;
}
