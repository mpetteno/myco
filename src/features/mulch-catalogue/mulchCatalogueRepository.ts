import { loadCatalogue } from '../catalogue/catalogueRepository';
import { removeCatalogueEntry } from '../catalogue/catalogueRemoval';
import { materialAvailable } from './mulchCatalogue';
import { getSupabaseClient } from '../../shared/supabase/client';
import { GardenStorageError } from '../gardens/gardenErrors';
import { mulchCatalogueError } from './mulchCatalogueErrors';
import { validateMulchDetails } from './mulchCatalogue';
import type { MulchCatalogue, MulchDetails, MulchType, MulchCategory } from './mulchCatalogue';

const columns = 'id,name,notes,version,category_id,plant_type_id,cultivar_id';
type MulchRow = { id: string; name: string; notes: string; version: number; category_id?: string | null; plant_type_id?: string | null; cultivar_id?: string | null };
const fromRow = (row: MulchRow): MulchType => ({ id: row.id, name: row.name, notes: row.notes, version: row.version, categoryId: row.category_id ?? null, plantTypeId: row.plant_type_id ?? null, cultivarId: row.cultivar_id ?? null });

export const removeMulchType = (current: MulchType): Promise<void> => removeCatalogueEntry('mulch_type', current);

export async function loadMulchCatalogue(userId: string): Promise<MulchCatalogue> {
  const client = getSupabaseClient();
  const [types, admin, categoryResult] = await Promise.all([
    client.from('mulch_types').select(columns).order('name'),
    client.from('catalogue_administrators').select('user_id').eq('user_id', userId).maybeSingle(),
    client.from('mulch_categories').select('*').order('name'),
  ]);
  if (types.error) throw mulchCatalogueError(types.error);
  if (admin.error) throw mulchCatalogueError(admin.error);
  if (categoryResult.error) throw mulchCatalogueError(categoryResult.error);
  const plants = await loadCatalogue(userId);
  const categories = (categoryResult.data ?? []) as MulchCategory[];
  return { types: (types.data as MulchRow[]).map(fromRow).map((type) => ({ ...type, categoryCode: categories.find((item) => item.id === type.categoryId)?.code, available: materialAvailable(type, categories, plants) })), categories, plants, isAdmin: !!admin.data };
}

export async function saveMulchType(details: MulchDetails, current?: MulchType): Promise<MulchType> {
  const problem = validateMulchDetails(details);
  if (problem) throw new GardenStorageError(problem);
  const payload = { name: details.name.trim(), notes: details.notes.trim(), category_id: details.categoryId ?? null, plant_type_id: details.plantTypeId ?? null, cultivar_id: details.cultivarId ?? null };
  const query = getSupabaseClient().from('mulch_types');
  const { data, error } = current
    ? await query.update(payload).eq('id', current.id).eq('version', current.version).select(columns).maybeSingle()
    : await query.insert(payload).select(columns).single();
  if (error) throw mulchCatalogueError(error);
  if (!data) throw new GardenStorageError('This entry changed or your administrator access was removed. Return to the catalogue and refresh before editing again.');
  return fromRow(data as MulchRow);
}
