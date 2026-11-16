import { getSupabaseClient } from '../../shared/supabase/client';
import { GardenStorageError } from '../gardens/gardenErrors';
import { validateGarden } from '../gardens/gardenDocument';
import type { GardenDocument } from '../gardens/gardenDocument';
import type { HistoryDraft } from './historyDraft';
import { validateEventDetails } from './gardenHistory';
import type { GardenEventDetails } from './gardenHistory';
import { historyError, loadGardenEvent, parseHistorySnapshot } from './historyRepository';

export async function loadHistoryAtDate(gardenId: string, date: string) {
  const client = getSupabaseClient();
  const access = await client.from('gardens').select('id').eq('id', gardenId).maybeSingle();
  if (access.error) throw historyError(access.error);
  if (!access.data) throw historyError({ code: '42501' });
  const { data, error } = await client.from('garden_layout_events').select('id').eq('garden_id', gardenId).is('deleted_at', null)
    .lte('event_date', date).order('event_date', { ascending: false }).order('event_order', { ascending: false }).limit(1).maybeSingle();
  if (error) throw historyError(error);
  return data ? loadGardenEvent(gardenId, data.id) : null;
}

export async function saveHistoricalEvent(gardenId: string, draft: HistoryDraft, document: GardenDocument,
  details: GardenEventDetails, eventId: string, requestId: string) {
  const problem = validateEventDetails(details) ?? validateGarden(document);
  if (problem) throw new GardenStorageError(problem);
  const { data, error } = await getSupabaseClient().rpc('save_garden_history_event', {
    p_garden_id: gardenId, p_event_id: eventId, p_event_version: draft.event?.eventVersion ?? null, p_request_id: requestId,
    p_event_date: details.date, p_title: details.title.trim(), p_notes: details.notes.trim(), p_document: document,
    p_kind: draft.kind, p_bed_id: draft.bedId ?? null,
  }).single();
  if (error?.code === '23514') throw new GardenStorageError('This bed conflicts with the recorded garden on that date. Start a new draft from the intended calendar date and check its position and size.');
  if (error) throw historyError(error);
  return parseHistorySnapshot(data);
}

export async function deleteHistoryEntry(gardenId: string, eventId: string, version: number, requestId: string) {
  const { error } = await getSupabaseClient().rpc('delete_garden_history_event', {
    p_garden_id: gardenId, p_event_id: eventId, p_event_version: version, p_request_id: requestId,
  });
  if (error) throw historyError(error);
}
