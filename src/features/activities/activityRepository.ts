import { getSupabaseClient } from '../../shared/supabase/client';
import { GardenStorageError } from '../gardens/gardenErrors';
import { historyError } from '../history/historyRepository';
import { validateActivity } from './activities';
import type { ActivityDetails } from './activities';

export async function recordCompletedActivity(gardenId: string, gardenVersion: number, details: ActivityDetails, id: string) {
  const problem = validateActivity(details);
  if (problem) throw new GardenStorageError(problem);
  const { error } = await getSupabaseClient().rpc('record_bed_changes', {
    p_garden_id: gardenId, p_expected_version: gardenVersion, p_event_id: id, p_bed_id: details.bedId,
    p_event_date: details.date, p_title: details.title.trim(), p_notes: details.notes.trim(),
  });
  if (error) throw historyError(error);
}
