import type { Bed, BedBounds } from './bed';
import type { GardenDimensions } from '../garden/garden';
import { snapToGridCm } from '../garden/garden';
import { rowPlan, validateAreaPlan } from '../area-editor/areaPlan';
import { previewPlanting } from '../planting/plantingGeometry';
import { validateMulchPlan } from '../mulch/mulchPlan';

// Map shared edges once, rather than rounding area widths independently.
// This preserves adjacency, gaps and IDs through both expansion and shrinking.
export function resizeBedContents(original: Bed, bounds: BedBounds): { bed: Bed; error: string | null } {
  const bed = { ...original, ...bounds };
  if (![bounds.widthCm, bounds.lengthCm].every((value) => Number.isSafeInteger(value) && value >= 5 && value % 5 === 0)) return { bed, error: 'Bed dimensions must use the 5 cm grid.' };
  if (original.widthCm === bounds.widthCm && original.lengthCm === bounds.lengthCm) return { bed, error: null };
  function scale<T extends BedBounds>(area: T): T {
    const edge = (value: number, oldSize: number, newSize: number) => Math.max(0, Math.min(newSize, snapToGridCm(value * newSize / oldSize)));
    const xCm = edge(area.xCm, original.widthCm, bounds.widthCm), yCm = edge(area.yCm, original.lengthCm, bounds.lengthCm);
    return { ...area, xCm, yCm, widthCm: edge(area.xCm + area.widthCm, original.widthCm, bounds.widthCm) - xCm,
      lengthCm: edge(area.yCm + area.lengthCm, original.lengthCm, bounds.lengthCm) - yCm };
  }
  let error: string | null = null;
  if (original.areaPlan) {
    bed.areaPlan = { ...original.areaPlan, areas: original.areaPlan.areas.map(scale) };
    error = validateAreaPlan(bed.areaPlan, bed);
    const rows = rowPlan(bed.areaPlan);
    if (!error && rows.areas.length) error = plantingFit(rows, bed);
  }
  if (!error && original.plantingPlan) {
    bed.plantingPlan = { ...original.plantingPlan, areas: original.plantingPlan.areas.map(scale) };
    if (bed.plantingPlan.areas.length) error = plantingFit(bed.plantingPlan, bed);
  }
  if (!error && original.mulchPlan) {
    bed.mulchPlan = { ...original.mulchPlan, areas: original.mulchPlan.areas.map(scale) };
    error = validateMulchPlan(bed.mulchPlan, bed);
  }
  return { bed, error: error ? `The areas need more space for their plants and the 5 cm grid. ${error}` : null };
}

function plantingFit(plan: NonNullable<Bed['plantingPlan']>, size: GardenDimensions) {
  const preview = previewPlanting(plan, size);
  return preview.error ?? (preview.counts.some((area) => !area.plants) ? 'Each planting area must still fit its plants.' : null);
}
