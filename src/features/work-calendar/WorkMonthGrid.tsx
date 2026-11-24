import { dayKey, parseDay } from '../history/gardenHistory';
import type { WorkEntry } from './workModel';

export function WorkMonthGrid({ month, day, entries, onMonth, onDay, onToday, disabled = false, compact = false }: { month: string; day: string; entries: WorkEntry[];
  disabled?: boolean; compact?: boolean; onMonth: (month: string) => void; onDay: (day: string) => void; onToday: () => void }) {
  const first = parseDay(`${month}-01`)!;
  const start = new Date(first); start.setUTCDate(1 - (first.getUTCDay() + 6) % 7);
  function step(delta: number) {
    const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + delta);
    const value = next.toISOString().slice(0, 7); if (/^\d{4}-\d{2}$/.test(value) && value >= '0001-01') onMonth(value);
  }
  return <section aria-label="Work month" className="space-y-2 rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-900">
    <div className="flex items-center gap-2">
      <button type="button" className="min-h-11 min-w-11 cursor-pointer rounded-lg focus-visible:outline-2" aria-label="Previous work month" disabled={disabled || month === '0001-01'} onClick={() => step(-1)}>←</button>
      <h2 className="min-w-0 flex-1 text-center font-semibold" aria-live="polite">{first.toLocaleDateString(undefined, { month: compact ? 'short' : 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
      <button type="button" className="min-h-11 min-w-11 cursor-pointer rounded-lg focus-visible:outline-2" aria-label="Next work month" disabled={disabled || month === '9999-12'} onClick={() => step(1)}>→</button>
      <button type="button" className="min-h-11 cursor-pointer rounded-lg px-2 text-sm underline" disabled={disabled} onClick={onToday}>Today</button>
    </div>
    <div className="grid grid-cols-7 text-center text-xs text-stone-500">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(value => <span key={value}>{value}</span>)}</div>
    <div className="grid grid-cols-7 gap-1">{Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start); date.setUTCDate(start.getUTCDate() + index); const key = date.toISOString().slice(0, 10);
      const items = entries.filter(entry => entry.date === key);
      return <button type="button" key={key} disabled={disabled || !parseDay(key)} aria-label={`${key}, ${items.length} activities`} aria-pressed={key === day} aria-current={key === dayKey() ? 'date' : undefined}
        onClick={() => onDay(key)} className={`relative ${compact ? 'min-h-11' : 'min-h-12'} cursor-pointer rounded-lg text-sm focus-visible:outline-2 aria-pressed:bg-green-800 aria-pressed:text-white dark:aria-pressed:bg-green-500 dark:aria-pressed:text-green-950 ${key.startsWith(month) ? '' : 'text-stone-400'}`}>
        {date.getUTCDate()}<span className="absolute inset-x-0 bottom-0.5 flex justify-center gap-0.5 text-[10px]" aria-hidden="true">
          {items.some(item => item.status === 'planned') && <span className="text-amber-600 dark:text-amber-300">●</span>}
          {items.some(item => item.status === 'overdue') && <span className="text-red-700 dark:text-red-300">●</span>}
          {items.some(item => item.status === 'completed') && <span className="text-green-700 dark:text-green-300">●</span>}
          {items.some(item => item.status === 'cancelled') && <span className="text-stone-500">●</span>}
        </span>
      </button>;
    })}</div>
    <p className="text-xs text-stone-600 dark:text-stone-400">Amber: planned · Red: overdue · Green: completed · Grey: cancelled</p>
  </section>;
}
