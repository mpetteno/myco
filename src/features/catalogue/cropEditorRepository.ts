import { getSupabaseClient } from '../../shared/supabase/client';
import { catalogueError } from './catalogueErrors';
import { cropChanges, cropDetailsPayload } from './cropEditor';
import type { CropDraft } from './cropEditor';
export async function saveCropEditor(cropId: string, cultivarId: string | undefined, version: number, cropVersion: number, draft: CropDraft, initial: CropDraft) {
  const { error } = await getSupabaseClient().rpc('myco_save_crop_editor', {
    crop_id: cropId, cultivar_id: cultivarId ?? null, expected_version: version, expected_crop_version: cropVersion,
    details: cropDetailsPayload(draft), changes: cropChanges(draft, initial, cropId, cultivarId),
  });
  if (error) throw catalogueError(error);
}
