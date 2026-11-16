import { english } from '../../shared/i18n/i18n';
import { getSupabaseClient } from '../../shared/supabase/client';
import { GardenStorageError } from '../gardens/gardenErrors';
import { validateGarden } from '../gardens/gardenDocument';
import type { GardenDocument } from '../gardens/gardenDocument';
import { compareEvents, validateEventDetails } from './gardenHistory';
import type { GardenEvent, GardenEventDetails, GardenEventSnapshot } from './gardenHistory';
import { actualHistory } from './actualHistory';

type EventRow = { id: string; garden_id: string; event_order: number; event_date: string; title: string; notes: string;
  source_version: number; recorded_at: string; actor_id: string | null; snapshot?: GardenDocument; display_snapshot?: GardenDocument; version?: number; updated_at?: string; deleted_at?: string | null;
  event_kind?: GardenEvent['kind']; bed_id?: string|null; activity_id?: string|null; planned_date?: string|null };
const columns = 'id,garden_id,event_order,event_date,title,notes,source_version,recorded_at,actor_id,event_kind,bed_id,activity_id,planned_date,version,updated_at';
const eventFromRow = (row: EventRow): GardenEvent => ({ id: row.id, gardenId: row.garden_id, order: row.event_order,
  date: row.event_date, title: row.title, notes: row.notes, sourceVersion: row.source_version, recordedAt: row.recorded_at, actorId: row.actor_id,
  eventVersion: row.version ?? 1, updatedAt: row.updated_at, kind: row.event_kind ?? 'layout', status:'completed', bedId:row.bed_id ?? undefined,activityId:row.activity_id ?? undefined,plannedDate:row.planned_date ?? undefined });

export function historyError(problem: unknown): GardenStorageError {
  if (problem instanceof GardenStorageError) return problem;
  const code = problem && typeof problem === 'object' && 'code' in problem ? problem.code : null;
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || code === 'PGRST204') return new GardenStorageError(english('history.unavailable'), false, 'history.unavailable');
  if (code === '42501' || code === 'P0002') return new GardenStorageError(english('history.accessRemoved'), false, 'history.accessRemoved');
  if (code === '40001') return new GardenStorageError(english('history.conflict'), true, 'history.conflict');
  if (code === 'P0001') return new GardenStorageError(english('history.bedConflict'), false, 'history.bedConflict');
  if (code === '22023' || code === '23514') return new GardenStorageError(english('history.invalid'), false, 'history.invalid');
  return new GardenStorageError(english('history.connection'), false, 'history.connection');
}
export function parseHistorySnapshot(value: unknown): GardenEventSnapshot {
  const row = value as EventRow;
  if (row?.deleted_at) throw historyError({ code: 'P0002' });
  const document = row?.display_snapshot ?? row?.snapshot;
  let invalid = true;
  try { invalid = !document || !!validateGarden(document); } catch { /* Reject unsupported stored formats. */ }
  if (invalid || !document) throw new GardenStorageError('This history event contains an unsupported or invalid layout.');
  return { ...eventFromRow(row), document };
}

export async function listGardenEvents(gardenId: string): Promise<GardenEvent[]> {
  const client = getSupabaseClient();
  const access = await client.from('gardens').select('id').eq('id', gardenId).maybeSingle();
  if (access.error) throw historyError(access.error);
  if (!access.data) throw historyError({ code: '42501' });
  const events: GardenEvent[] = [];
  let cursor = 0;
  while (true) {
    const { data, error } = await client.from('garden_layout_events').select(columns).eq('garden_id', gardenId).is('deleted_at', null)
      .gt('event_order', cursor).order('event_order').limit(200);
    if (error) throw historyError(error);
    const rows = data as EventRow[];
    events.push(...rows.map(eventFromRow));
    if (rows.length < 200) break;
    cursor = rows.at(-1)!.event_order;
  }
  return events.sort(compareEvents);
}
export async function loadGardenEvent(gardenId: string, id: string): Promise<GardenEventSnapshot> {
  const { data, error } = await getSupabaseClient().from('garden_layout_events').select(`${columns},snapshot,display_snapshot`)
    .eq('garden_id', gardenId).eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) throw historyError(error);
  if (!data) throw historyError({ code: 'P0002' });
  const selected = parseHistorySnapshot(data as EventRow);
  if ((data as EventRow).display_snapshot || selected.kind === 'layout') return selected;
  const sequence: GardenEventSnapshot[] = [];
  let cursor = 0;
  while (true) {
    const { data: rows, error: problem } = await getSupabaseClient().from('garden_layout_events').select(`${columns},snapshot,display_snapshot`)
      .eq('garden_id',gardenId).is('deleted_at', null).lte('event_date',selected.date).gt('event_order',cursor).order('event_order').limit(200);
    if (problem) throw historyError(problem);
    const page = rows as EventRow[];
    sequence.push(...page.map(parseHistorySnapshot));
    if (page.length < 200) break;
    cursor = page.at(-1)!.event_order;
  }
  return { ...selected, document:actualHistory(sequence,selected) };
}
export async function recordGardenEvent(gardenId: string, version: number, details: GardenEventDetails, requestId: string): Promise<GardenEventSnapshot> {
  const problem = validateEventDetails(details);
  if (problem) throw new GardenStorageError(problem);
  const { data, error } = await getSupabaseClient().rpc('record_garden_layout_event', { p_garden_id: gardenId,
    p_expected_version: version, p_event_id: requestId, p_event_date: details.date, p_title: details.title.trim(), p_notes: details.notes.trim() }).single();
  if (error) throw historyError(error);
  return parseHistorySnapshot(data as EventRow);
}
