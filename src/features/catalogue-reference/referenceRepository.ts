import { getSupabaseClient } from '../../shared/supabase/client';
import { catalogueError } from '../catalogue/catalogueErrors';
import { removeCatalogueEntry } from '../catalogue/catalogueRemoval';
import { GardenStorageError } from '../gardens/gardenErrors';
import { referenceTables } from './referenceModel';
import type { ReferenceTable, ReferenceRow, ReferenceData } from './referenceModel';

export const removeCultivar = (current: ReferenceRow): Promise<void> => removeCatalogueEntry('cultivar', current);

export async function loadReferenceData(userId: string): Promise<ReferenceData> {
  const tables = [...referenceTables, 'plant_types', 'plant_families', 'calendar_windows'] as const;
  const client = getSupabaseClient();
  const results = await Promise.all(tables.map(async (table) => {
    const rows: ReferenceRow[] = [];
    for (let offset = 0; ; offset += 200) {
      const { data, error } = await client.from(table).select('*').order('created_at').order('id').range(offset, offset + 199);
      if (error) throw catalogueError(error);
      rows.push(...data as ReferenceRow[]);
      if (data.length < 200) return rows;
    }
  }));
  const admin = await client.from('catalogue_administrators').select('user_id').eq('user_id', userId).maybeSingle();
  if (admin.error) throw catalogueError(admin.error);
  return { ...Object.fromEntries(tables.map((table, index) => [table, results[index]])), isAdmin: !!admin.data } as ReferenceData;
}
export async function saveReference(table: ReferenceTable, payload: Record<string, unknown>, current?: ReferenceRow,
  windows?: { start_month: number; end_month: number }[]): Promise<void> {
  if (!referenceTables.includes(table)) throw new GardenStorageError('Unknown catalogue section.');
  const client = getSupabaseClient();
  if (table === 'plant_calendar_entries') {
    const { error } = await client.rpc('myco_save_calendar_entry', { entry_id: current?.id ?? null, expected_version: current?.version ?? null, details: payload, windows: windows ?? [] });
    if (error) throw catalogueError(error);
    return;
  }
  const query = client.from(table);
  const { data, error } = current
    ? await query.update(payload).eq('id', current.id).eq('version', current.version).select('id').maybeSingle()
    : await query.insert(payload).select('id').single();
  if (error) throw catalogueError(error);
  if (!data) throw new GardenStorageError('This entry changed or administrator access was removed. Refresh before editing again.');
}
