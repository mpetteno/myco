import { getSupabaseClient } from '../../shared/supabase/client';
import type { GardenDocument, GardenSummary, SavedGarden } from './gardenDocument';
import { validateGarden } from './gardenDocument';
import { GardenStorageError, gardenStorageError } from './gardenErrors';

const summaryColumns = 'id,owner_id,name,width_cm,length_cm,version,updated_at';
const columns = `${summaryColumns},beds`;
type Row = { id: string; owner_id: string; name: string; width_cm: number; length_cm: number;
  version: number; updated_at: string; beds?: SavedGarden['beds'] };
const summary = (row: Row): GardenSummary => ({ id: row.id, ownerId: row.owner_id, name: row.name,
  dimensions: { widthCm: row.width_cm, lengthCm: row.length_cm }, version: row.version, updatedAt: row.updated_at });

function saved(row: Row): SavedGarden {
  const garden = { ...summary(row), beds: row.beds ?? [] };
  if (validateGarden(garden)) throw new GardenStorageError('This saved garden contains an invalid layout.');
  return garden;
}

function payload(document: GardenDocument) {
  const error = validateGarden(document);
  if (error) throw new GardenStorageError(error);
  return { name: document.name.trim(), width_cm: document.dimensions.widthCm,
    length_cm: document.dimensions.lengthCm, beds: document.beds };
}

export async function listGardens(): Promise<GardenSummary[]> {
  const { data, error } = await getSupabaseClient().from('gardens').select(summaryColumns)
    .order('updated_at', { ascending: false });
  if (error) throw gardenStorageError(error);
  return (data as Row[]).map(summary);
}

export async function loadGarden(id: string): Promise<SavedGarden> {
  const { data, error } = await getSupabaseClient().from('gardens').select(columns).eq('id', id).maybeSingle();
  if (error) throw gardenStorageError(error);
  if (!data) throw new GardenStorageError('This garden is no longer available, or your access was removed.');
  return saved(data as Row);
}

export async function createGarden(ownerId: string, document: GardenDocument): Promise<SavedGarden> {
  const { data, error } = await getSupabaseClient().from('gardens')
    .insert({ ...payload(document), owner_id: ownerId }).select(columns).single();
  if (error) throw gardenStorageError(error);
  return saved(data as Row);
}

export async function saveGarden(current: SavedGarden, document: GardenDocument): Promise<SavedGarden> {
  const { data, error } = await getSupabaseClient().from('gardens').update(payload(document))
    .eq('id', current.id).eq('version', current.version).select(columns).maybeSingle();
  if (error) throw gardenStorageError(error);
  if (!data) throw new GardenStorageError('This garden changed in another session, or your access was removed. Reload the saved version or discard changes and reload your gardens.', true);
  return saved(data as Row);
}
