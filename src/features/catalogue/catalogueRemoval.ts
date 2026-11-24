import { getSupabaseClient } from '../../shared/supabase/client';
import { english } from '../../shared/i18n/i18n';
import type { TranslationKey } from '../../shared/i18n/i18n';
import { GardenStorageError } from '../gardens/gardenErrors';

export type CatalogueRemovalKind = 'mulch_type' | 'cultivar' | 'plant_family' | 'plant_type' | 'seed_mixture' | 'mulch_category';

export async function removeCatalogueEntry(kind: CatalogueRemovalKind, current: { id: string; version: number }): Promise<void> {
  const { error } = await getSupabaseClient().rpc(`myco_remove_${kind}`, { entry_id: current.id, expected_version: current.version });
  if (!error) return;
  let key: TranslationKey = 'catalogue.removalFailed';
  if (error.code === '42501') key = 'catalogue.removalAdminOnly';
  else if (error.code === '40001') key = 'catalogue.removalStale';
  else if (error.code === '23503') key = ({ cultivar: 'catalogue.cultivarInUse', plant_family: 'catalogue.familyInUse', plant_type: 'catalogue.cropInUse', mulch_category: 'catalogue.categoryInUse' } as Partial<Record<CatalogueRemovalKind, TranslationKey>>)[kind] ?? 'catalogue.removalInUse';
  else if (['PGRST202', '42883'].includes(error.code)) key = 'catalogue.removalUnavailable';
  throw new GardenStorageError(english(key), error.code === '40001', key);
}
