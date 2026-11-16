import type { BedPlantingPlan, PlantingArea } from './plantingPlan';
import { FIXED_AREA_MARGIN_CM, MIN_AREA_MARGIN_CM } from './plantingPlan';

// Keep these based on the saved reference, independent of resize-driven row gaps.
export function areaSpacingMargins(area: PlantingArea) {
  const halfOnGrid = (spacing: number) => Math.max(5, Math.ceil(spacing / 10) * 5);
  return { alongCm: halfOnGrid(area.plant.plantSpacingCm ?? area.plantSpacingCm),
    acrossCm: halfOnGrid(area.plant.rowSpacingCm ?? area.rowSpacingCm) };
}

export function planAreaMargins(plan: Pick<BedPlantingPlan, 'version'>, area: PlantingArea) {
  if (plan.version === 5) return { alongCm: area.plant.borderDistanceCm ?? MIN_AREA_MARGIN_CM, acrossCm: area.plant.borderDistanceCm ?? MIN_AREA_MARGIN_CM };
  return plan.version >= 4 ? { alongCm: FIXED_AREA_MARGIN_CM, acrossCm: FIXED_AREA_MARGIN_CM } : areaSpacingMargins(area);
}
