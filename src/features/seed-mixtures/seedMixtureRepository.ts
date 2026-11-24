import { getSupabaseClient } from '../../shared/supabase/client';
import { catalogueError } from '../catalogue/catalogueErrors';
import { GardenStorageError } from '../gardens/gardenErrors';
import { validateSeedMixture } from './seedMixture';
import type { SeedMixture, SeedMixtureDetails } from './seedMixture';

export async function loadSeedMixtures(): Promise<SeedMixture[]> {
  const client = getSupabaseClient();
  const [mixtures, components] = await Promise.all([
    client.from('seed_mixtures').select('id,name,notes,version').order('name'),
    client.from('seed_mixture_components').select('id,mixture_id,plant_type_id,cultivar_id,weight_percent').order('position'),
  ]);
  for (const result of [mixtures, components]) if (result.error) throw catalogueError(result.error);
  return (mixtures.data ?? []).map((row) => ({ ...row, version: Number(row.version), components: (components.data ?? []).filter((item) => item.mixture_id === row.id)
    .map((item) => ({ plantTypeId: item.plant_type_id, cultivarId: item.cultivar_id, percentage: Number(item.weight_percent) })) }));
}
export async function saveSeedMixture(details: SeedMixtureDetails, current?: SeedMixture): Promise<string> {
  const problem = validateSeedMixture(details);
  if (problem) throw new GardenStorageError(problem);
  const { data, error } = await getSupabaseClient().rpc('myco_save_seed_mixture', {
    mixture_id: current?.id ?? null, expected_version: current?.version ?? null,
    details: { name: details.name.trim(), notes: details.notes.trim() },
    components: details.components.map((item) => ({ plant_type_id: item.plantTypeId, cultivar_id: item.cultivarId, weight_percent: item.percentage })),
  });
  if (error) throw catalogueError(error);
  return data as string;
}
