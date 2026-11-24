import { validateWork } from './taskWork';
import type { WorkItem } from './taskWork';
import { dayKey, parseDay } from '../history/gardenHistory';
import type { GardenEvent } from '../history/gardenHistory';

export const activityTypes = ['planting', 'mulch', 'care', 'harvest', 'other'] as const;
export type ActivityType = typeof activityTypes[number];
export const activityLabels: Record<ActivityType, string> = { planting: 'Planting', mulch: 'Mulch', care: 'Care', harvest: 'Harvest', other: 'Other' };
export type TaskDetails = { gardenId: string; bedId: string; activityType: ActivityType; plannedDate: string; title: string; notes: string; workRecap?: string; workItems?: WorkItem[] };
export type GardenTask = TaskDetails & { id: string; order: number; version: number; bedName?: string; status: 'planned' | 'completed' | 'cancelled'; completedDate?: string; completedNotes?: string; completionEventId?: string };
export type WorkEvent = GardenEvent & { bedName?: string; deleted: boolean };
export type WorkEntry = { id: string; gardenId: string; bedId?: string; bedName?: string; title: string; notes: string; date: string;
  status: 'planned' | 'overdue' | 'completed' | 'cancelled'; activityType: ActivityType; task?: GardenTask; event?: WorkEvent; historyRemoved?: boolean; plannedDate?: string };

export function validateTask(details: TaskDetails) {
  if (!details.gardenId) return 'Choose a garden.';
  if (!activityTypes.includes(details.activityType)) return 'Choose an activity type.';
  if (!parseDay(details.plannedDate)) return 'Choose a valid planned date.';
  if (!details.title.trim() || details.title.trim().length > 120) return 'Enter a title of 1 to 120 characters.';
  if (details.notes.length > 2000) return 'Use at most 2,000 characters for notes.';
  if (details.workRecap !== undefined || details.workItems !== undefined) return validateWork(details.workRecap ?? '', details.workItems ?? []);
  return null;
}
export function combineWork(tasks: GardenTask[], events: WorkEvent[], today = dayKey()): WorkEntry[] {
  const byId = new Map(events.map(event => [event.id, event]));
  const linked = new Set(tasks.map(task => task.completionEventId).filter(Boolean));
  const result: WorkEntry[] = tasks.map(task => {
    const event = task.completionEventId ? byId.get(task.completionEventId) : undefined;
    const completed = task.status === 'completed';
    return { id: `task:${task.id}`, gardenId: task.gardenId, bedId: task.bedId || undefined, bedName: event?.bedName ?? task.bedName,
      title: event?.title ?? task.title, notes: event?.notes ?? (completed ? task.completedNotes ?? '' : task.notes),
      date: completed ? event?.date ?? task.completedDate! : task.plannedDate,
      status: task.status === 'planned' && task.plannedDate < today ? 'overdue' : task.status,
      activityType: task.activityType, task, event: event?.deleted ? undefined : event,
      historyRemoved: completed && (!event || event.deleted), plannedDate: task.plannedDate };
  });
  for (const event of events) if (!event.deleted && !linked.has(event.id)) result.push({ id: `event:${event.id}`, gardenId: event.gardenId,
    bedId: event.bedId, bedName: event.bedName, title: event.title, notes: event.notes, date: event.date, status: 'completed',
    activityType: event.kind === 'mulch' ? 'mulch' : event.kind === 'planting' ? 'planting' : 'other', event, plannedDate: event.plannedDate });
  return result.sort((a, b) => a.date.localeCompare(b.date) || (a.event?.order ?? a.task?.order ?? 0) - (b.event?.order ?? b.task?.order ?? 0) || a.id.localeCompare(b.id));
}
export type WorkFilters = { gardenIds: string[]; bed: string; status: string; activity: string; month: string; day: string; allDates: boolean };
export function filterWork(entries: WorkEntry[], filters: WorkFilters) {
  return entries.filter(entry => filters.gardenIds.includes(entry.gardenId)
    && (!filters.bed || `${entry.gardenId}:${entry.bedId}` === filters.bed)
    && (!filters.status ? entry.status !== 'cancelled' : entry.status === filters.status)
    && (!filters.activity || entry.activityType === filters.activity)
    && (!filters.day || entry.date === filters.day)
    && (filters.allDates || entry.date.startsWith(filters.month)));
}
