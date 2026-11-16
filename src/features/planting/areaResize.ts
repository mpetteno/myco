import type { GardenDimensions } from '../garden/garden';
import type { BedBounds } from '../beds/bed';
import { areaRowLayout } from './areaRowLayout';
import type { BedPlantingPlan, PlantingArea } from './plantingPlan';
import { MAX_PREVIEW_PLANTS } from './plantingPlan';
import { resizeAreas } from '../area-editor/resizeAreas';

export function resizePlantingAreas(plan: BedPlantingPlan, id: string, bounds: BedBounds, bed: GardenDimensions) {
  const areas = resizeAreas(plan.areas, id, bounds, bed);
  if (!areas) return null;
  const next = { ...plan, areas };
  return areas.every((area) => canResizePlantingArea(next, area, area, bed)) ? areas : null;
}

export function canResizePlantingArea(plan: BedPlantingPlan, area: PlantingArea, bounds: BedBounds, bed: GardenDimensions) {
  if (!(area.plantSpacingCm > 0 && area.rowSpacingCm > 0)) return true;
  const layout = areaRowLayout(plan, { ...area, ...bounds }, bed);
  return !layout.error && layout.rows > 0 && layout.columns > 0 && layout.rows * layout.columns <= MAX_PREVIEW_PLANTS;
}
