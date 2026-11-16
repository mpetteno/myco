import { getSupabaseClient } from '../../shared/supabase/client';
import { GardenStorageError } from '../gardens/gardenErrors';
import { mulchCatalogueError } from './mulchCatalogueErrors';
import { validateMulchDetails } from './mulchCatalogue';
import type { MulchCatalogue, MulchDetails, MulchType } from './mulchCatalogue';

const columns = 'id,name,notes,version';

export async function loadMulchCatalogue(userId: string): Promise<MulchCatalogue> {
  const client = getSupabaseClient();
  const [types, admin] = await Promise.all([
    client.from('mulch_types').select(columns).order('name'),
    client.from('catalogue_administrators').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);
  if (types.error) throw mulchCatalogueError(types.error);
  if (admin.error) throw mulchCatalogueError(admin.error);
  return { types: types.data as MulchType[], isAdmin: !!admin.data };
}

export async function saveMulchType(details: MulchDetails, current?: MulchType): Promise<MulchType> {
  const problem = validateMulchDetails(details);
  if (problem) throw new GardenStorageError(problem);
  const payload = { name: details.name.trim(), notes: details.notes.trim() };
  const query = getSupabaseClient().from('mulch_types');
  const { data, error } = current
    ? await query.update(payload).eq('id', current.id).eq('version', current.version).select(columns).maybeSingle()
    : await query.insert(payload).select(columns).single();
  if (error) throw mulchCatalogueError(error);
  if (!data) throw new GardenStorageError('This entry changed or your administrator access was removed. Return to the catalogue and refresh before editing again.');
  return data as MulchType;
}
