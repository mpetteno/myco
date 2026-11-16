import type { GardenDimensions } from '../garden/garden';
import { MAX_PREVIEW_PLANTS, validatePlantingPlan } from './plantingPlan';
import type { BedPlantingPlan, PlantPoint } from './plantingPlan';
import { areaRowLayout } from './areaRowLayout';
export { gridSpacingCm } from './areaRowLayout';

export type PlantRowGuide = { areaIndex: number; x1Cm: number; y1Cm: number; x2Cm: number; y2Cm: number; warning?: boolean };
export type PlantingPreview = { points: PlantPoint[]; rowGuides: PlantRowGuide[];
  counts: { plants: number; rows: number; emptyRows?: number }[]; error: string | null };

export function previewPlanting(plan: BedPlantingPlan, bed: GardenDimensions): PlantingPreview {
  const counts: PlantingPreview['counts'] = Array.isArray(plan.areas) ? plan.areas.map(() => ({ plants: 0, rows: 0 })) : [];
  const fail = (error: string): PlantingPreview => ({ points: [], rowGuides: [], counts: counts.map(() => ({ plants: 0, rows: 0 })), error });
  const error = validatePlantingPlan(plan, bed);
  if (error) return fail(error);
  const layouts = plan.areas.map((area) => areaRowLayout(plan, area, bed));
  let candidates = 0;
  for (const layout of layouts) {
    if (layout.error) return fail(layout.error);
    candidates += layout.columns * layout.rows;
    if (!Number.isSafeInteger(candidates) || candidates > MAX_PREVIEW_PLANTS) return fail(`This plan exceeds ${MAX_PREVIEW_PLANTS.toLocaleString()} candidate plants. Increase spacing or use smaller areas.`);
  }
  const maxX = Math.max(...layouts.map((item) => item.gapX)), maxY = Math.max(...layouts.map((item) => item.gapY));
  const buckets = new Map<string, PlantPoint[]>(), points: PlantPoint[] = [], rowGuides: PlantRowGuide[] = [];
  for (const [areaIndex, layout] of layouts.entries()) {
    const { alongWidth, alongStart, alongEnd, plantStep, columns, rows, rowPosition } = layout;
    for (let rowIndex = 0; rowIndex < rows && columns > 0; rowIndex++) {
      const across = rowPosition(rowIndex);
      let populated = false;
      for (let column = 0; column < columns; column++) {
        const along = alongStart + column * plantStep;
        const point: PlantPoint = { xCm: alongWidth ? along : across, yCm: alongWidth ? across : along, areaIndex, rowIndex };
        const bucketX = Math.floor(point.xCm / maxX), bucketY = Math.floor(point.yCm / maxY);
        let conflict = false;
        if (plan.respectAreaSpacing) for (let dx = -1; dx <= 1 && !conflict; dx++) for (let dy = -1; dy <= 1 && !conflict; dy++) {
          conflict = (buckets.get(`${bucketX + dx}:${bucketY + dy}`) ?? []).some((other) => {
            if (other.areaIndex === areaIndex) return false;
            const previous = layouts[other.areaIndex];
            return Math.abs(point.xCm - other.xCm) < Math.max(layout.gapX, previous.gapX)
              && Math.abs(point.yCm - other.yCm) < Math.max(layout.gapY, previous.gapY);
          });
        }
        if (conflict) continue;
        points.push(point); counts[areaIndex].plants++; populated = true;
        const key = `${bucketX}:${bucketY}`, bucket = buckets.get(key) ?? [];
        bucket.push(point); buckets.set(key, bucket);
      }
      if (populated || plan.version >= 2) {
        counts[areaIndex].rows++;
        if (!populated) counts[areaIndex].emptyRows = (counts[areaIndex].emptyRows ?? 0) + 1;
        const reference = plan.areas[areaIndex].plant.rowSpacingCm;
        const warning = reference !== null && ((rowIndex > 0 && across - rowPosition(rowIndex - 1) < reference)
          || (rowIndex + 1 < rows && rowPosition(rowIndex + 1) - across < reference));
        rowGuides.push({ areaIndex, warning, x1Cm: alongWidth ? alongStart : across, y1Cm: alongWidth ? across : alongStart,
          x2Cm: alongWidth ? alongEnd : across, y2Cm: alongWidth ? across : alongEnd });
      }
    }
  }
  return { points, rowGuides, counts, error: null };
}
