import type { Catalogue } from '../catalogue/catalogue';
import type { PlantSnapshot } from '../planting/plantingPlan';
import { snapshotPlant } from '../planting/plantingPlan';

export type SeedMixtureComponent = { plantTypeId: string; cultivarId: string | null; percentage: number };
export type SeedMixture = { id: string; name: string; notes: string; version: number; components: SeedMixtureComponent[] };
export type SeedMixtureDetails = Omit<SeedMixture, 'id' | 'version'>;
export type SeedMixtureSnapshot = Omit<SeedMixture, 'components'> & { components: { plant: PlantSnapshot; percentage: number }[] };
export function validateSeedMixture(details: SeedMixtureDetails): string | null {
  if (!details.name.trim() || details.name.trim().length > 100 || details.notes.length > 2000) return 'Enter a mixture name of 1 to 100 characters and notes within 2000 characters.';
  if (!Array.isArray(details.components) || !details.components.length || details.components.length > 50) return 'Use 1 to 50 mixture components.';
  const keys = new Set<string>();
  for (const item of details.components) {
    const key = `${item.plantTypeId}:${item.cultivarId ?? ''}`;
    if (!item.plantTypeId || !Number.isFinite(item.percentage) || item.percentage <= 0 || item.percentage > 100 || keys.has(key)) return 'Choose each crop/cultivar once and a percentage above 0 and at most 100.';
    keys.add(key);
  }
  if (Math.abs(details.components.reduce((sum, item) => sum + item.percentage, 0) - 100) > 0.000001) return 'Mixture percentages by weight must total 100%.';
  return null;
}
export function snapshotSeedMixture(mixture: SeedMixture, catalogue: Catalogue): SeedMixtureSnapshot {
  return { ...structuredClone(mixture), components: mixture.components.map((component) => {
    const crop = catalogue.plants.find((item) => item.id === component.plantTypeId);
    const cultivar = component.cultivarId ? catalogue.cultivars?.find((item) => item.id === component.cultivarId && item.plantTypeId === component.plantTypeId) : undefined;
    if (!crop || (component.cultivarId && !cultivar)) throw Error('This mixture contains an unavailable crop or cultivar. Refresh the catalogue.');
    return { plant: snapshotPlant(crop, catalogue, cultivar), percentage: component.percentage };
  }) };
}
