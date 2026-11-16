import { useEffect, useState } from 'react';
import { parseDay, dayKey } from './gardenHistory';
import type { GardenEvent } from './gardenHistory';

export function HistoryCalendar({ date, events, disabled, onDate }: { date: string; events: GardenEvent[];
  disabled: boolean; onDate: (date: string) => void }) {
  const [month, setMonth] = useState(date.slice(0, 7));
  useEffect(() => { setMonth(date.slice(0, 7)); }, [date]);
  const first = parseDay(`${month}-01`)!;
  const start = new Date(first), offset = (first.getUTCDay() + 6) % 7;
  start.setUTCDate(1 - offset);
  const counts = new Map<string, number>();
  events.forEach((event) => counts.set(event.date, (counts.get(event.date) ?? 0) + 1));
  function step(direction: number) {
    const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + direction);
    const key = next.toISOString().slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(key) && key >= '0001-01') setMonth(key);
  }
  const monthLabel = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return <section aria-label="History calendar" className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <button type="button" aria-label="Previous month" disabled={disabled} onClick={() => step(-1)} className="min-h-11 min-w-11 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50">←</button>
      <h3 aria-live="polite" className="text-sm font-semibold">{monthLabel}</h3>
      <button type="button" aria-label="Next month" disabled={disabled} onClick={() => step(1)} className="min-h-11 min-w-11 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50">→</button>
    </div>
    <div className="grid grid-cols-7 text-center text-xs text-stone-600 dark:text-stone-400">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}
    </div>
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: 42 }, (_, index) => {
        const day = new Date(start); day.setUTCDate(start.getUTCDate() + index);
        const key = day.toISOString().slice(0, 10), count = counts.get(key) ?? 0;
        return <button key={key} type="button" disabled={disabled || !parseDay(key)} aria-pressed={key === date}
          aria-current={key === dayKey() ? 'date' : undefined} aria-label={`${key}${count ? `, ${count} events` : ', no events'}`}
          onClick={() => onDate(key)} className={`relative min-h-11 cursor-pointer rounded-lg text-sm aria-pressed:bg-green-800 aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:aria-pressed:bg-green-500 dark:aria-pressed:text-green-950 ${key.startsWith(month) ? '' : 'text-stone-400 dark:text-stone-600'}`}>
          {day.getUTCDate()}{count > 0 && <span aria-hidden="true" className="absolute inset-x-0 bottom-0.5 text-[10px] leading-none">
            {events.some((event) => event.date === key && event.status !== 'planned') && <span className="text-green-600 dark:text-green-300">●</span>}
          </span>}
        </button>;
      })}
    </div>
  </section>;
}
