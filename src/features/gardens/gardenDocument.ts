import type { Bed } from '../beds/bed';
import { bedsOverlap, isInsideGarden } from '../beds/bed';
import type { GardenDimensions } from '../garden/garden';
import { previewPlanting } from '../planting/plantingGeometry';
import { validatePlantingPlan } from '../planting/plantingPlan';
import { validateMulchPlan } from '../mulch/mulchPlan';

export type GardenDocument = { name: string; dimensions: GardenDimensions; beds: Bed[] };
export type GardenSummary = {
  id: string; ownerId: string; name: string; dimensions: GardenDimensions;
  version: number; updatedAt: string;
};
export type SavedGarden = GardenSummary & { beds: Bed[] };

export function validateGarden(document: GardenDocument): string | null {
  if (!document.name.trim() || document.name.trim().length > 100) return 'Enter a garden name of 1 to 100 characters.';
  const { widthCm, lengthCm } = document.dimensions;
  if (![widthCm, lengthCm].every((n) => Number.isSafeInteger(n) && n >= 5 && n % 5 === 0)) {
    return 'Garden dimensions must be positive multiples of 5 cm.';
  }
  const ids = new Set<string>();
  for (const bed of document.beds) {
    if (typeof bed.id !== 'string' || !bed.id.trim() || ids.has(bed.id)
      || typeof bed.name !== 'string' || !bed.name.trim()
      || ![bed.xCm, bed.yCm, bed.widthCm, bed.lengthCm].every((n) => Number.isSafeInteger(n) && n % 5 === 0)
      || bed.widthCm < 5 || bed.lengthCm < 5 || !isInsideGarden(bed, document.dimensions)) {
      return 'A bed has invalid dimensions or a position outside the garden.';
    }
    if (document.beds.some((other) => ids.has(other.id) && bedsOverlap(bed, other))) return 'Beds cannot overlap.';
    if (bed.plantingPlan !== undefined) {
      const invalid = validatePlantingPlan(bed.plantingPlan, bed);
      if (invalid) return invalid;
      const preview = previewPlanting(bed.plantingPlan, bed);
      if (preview.error) return preview.error;
      if (preview.points.length === 0) return 'A saved planting plan must contain plants.';
    }
    if (bed.mulchPlan !== undefined) {
      const invalid = validateMulchPlan(bed.mulchPlan, bed);
      if (invalid) return invalid;
    }
    ids.add(bed.id);
  }
  return null;
}
