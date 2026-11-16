import { getSupabaseClient } from '../../shared/supabase/client';
import { GardenStorageError, gardenStorageError } from '../gardens/gardenErrors';

export type GardenMember = { userId: string; email: string };

function sharingError(problem: { code?: string }) {
  if (problem.code === 'P0002') return new GardenStorageError('No confirmed account uses this email. Ask them to sign up and confirm their email first.');
  if (problem.code === '22023') return new GardenStorageError('Enter another user’s email address. The owner already has access.');
  if (problem.code === '42501') return new GardenStorageError('Only the garden owner can manage sharing.');
  if (problem.code === 'PGRST202') return new GardenStorageError('Garden sharing is not available yet. Please contact the app owner.');
  return gardenStorageError(problem);
}

export async function listGardenMembers(gardenId: string): Promise<GardenMember[]> {
  const { data, error } = await getSupabaseClient().rpc('list_garden_members', { p_garden_id: gardenId });
  if (error) throw sharingError(error);
  return (data as { user_id: string; email: string }[]).map((member) => ({ userId: member.user_id, email: member.email }));
}

export async function shareGarden(gardenId: string, email: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('share_garden', { p_garden_id: gardenId, p_email: email.trim() });
  if (error) throw sharingError(error);
}

export async function unshareGarden(gardenId: string, userId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('unshare_garden', { p_garden_id: gardenId, p_user_id: userId });
  if (error) throw sharingError(error);
}
