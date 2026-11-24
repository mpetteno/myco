import { english } from '../../shared/i18n/i18n';
import type { Translator } from '../../shared/i18n/i18n';
import type { GardenDocument } from '../gardens/gardenDocument';

export type GardenEventDetails = { date: string; title: string; notes: string };
export type GardenEvent = GardenEventDetails & { id: string; gardenId: string; order: number;
  sourceVersion: number; recordedAt: string; actorId: string | null; eventVersion?: number; updatedAt?: string; kind?: 'layout' | 'bed' | 'planting' | 'mulch';
  status?: 'planned' | 'completed'; bedId?: string; activityId?: string; activityVersion?: number; plannedDate?: string };
export type GardenEventSnapshot = GardenEvent & { document: GardenDocument };

export function dayKey(date = new Date()) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return null;
  const [year, month, day] = value.split('-').map(Number), date = new Date(0);
  date.setUTCFullYear(year, month - 1, day); date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10) === value ? date : null;
}
export function validateEventDetails(details: GardenEventDetails, t: Translator = english): string | null {
  if (!parseDay(details.date)) return t('validation.eventDate');
  if (!details.title.trim() || details.title.trim().length > 120) return t('validation.eventTitle');
  if (details.notes.length > 2000) return t('validation.eventNotes');
  return null;
}
export const compareEvents = (a: GardenEvent, b: GardenEvent) => a.date.localeCompare(b.date) || a.order - b.order;
export const eventOnDate = (events: GardenEvent[], date: string) => events.filter((event) => event.status !== 'planned' && event.date <= date).at(-1) ?? null;
