import type { GardenDimensions } from '../garden/garden';
import { areaRowLayout } from './areaRowLayout';
import type { BedPlantingPlan, PlantingArea } from './plantingPlan';
import { effectiveClearances } from './plantClearances';

type PointCm = { xCm: number; yCm: number };
export type AreaMeasurement = { id: string; kind: 'border' | 'row-gap'; distanceCm: number;
  recommendedCm: number | null; warning: boolean; start: PointCm; end: PointCm };

export function getAreaMeasurements(plan: BedPlantingPlan, area: PlantingArea, bed: GardenDimensions): AreaMeasurement[] {
  const layout = areaRowLayout(plan, area, bed);
  if (layout.error || layout.rows < 1 || layout.columns < 1 || !Number.isFinite(layout.rows)
    || !Number.isFinite(layout.columns) || layout.rows * layout.columns > 20000) return [];
  const { alongWidth, alongStart, columns, plantStep, rows, rowPosition } = layout;
  const point = (along: number, across: number): PointCm => ({ xCm: alongWidth ? along : across, yCm: alongWidth ? across : along });
  const alongOrigin = alongWidth ? area.xCm : area.yCm, acrossOrigin = alongWidth ? area.yCm : area.xCm;
  const alongSize = alongWidth ? area.widthCm : area.lengthCm, acrossSize = alongWidth ? area.lengthCm : area.widthCm;
  const firstRow = rowPosition(0), lastRow = rowPosition(rows - 1), lastPlant = alongStart + (columns - 1) * plantStep;
  const measurements: AreaMeasurement[] = [];
  function add(id: string, kind: AreaMeasurement['kind'], start: PointCm, end: PointCm, recommendedCm: number | null) {
    const distanceCm = Math.abs(end.xCm - start.xCm) + Math.abs(end.yCm - start.yCm);
    measurements.push({ id, kind, start, end, distanceCm, recommendedCm, warning: recommendedCm !== null && distanceCm < recommendedCm });
  }
  const rowMargin = plan.version === 5 && area.plant.borderDistanceCm !== undefined ? area.plant.borderDistanceCm
    : area.plant.rowSpacingCm === null ? null : area.plant.rowSpacingCm / 2;
  const plantMargin = plan.version === 5 && area.plant.borderDistanceCm !== undefined ? area.plant.borderDistanceCm
    : area.plant.plantSpacingCm === null ? null : area.plant.plantSpacingCm / 2;
  const near = alongOrigin + alongSize * 0.25, far = alongOrigin + alongSize * 0.75;
  const centre = alongOrigin + alongSize / 2;
  const margins = effectiveClearances(area);
  add('row-start', 'border', point(near, acrossOrigin), point(near, firstRow), plan.version === 5 ? alongWidth ? margins.top : margins.left : rowMargin);
  add('row-end', 'border', point(far, lastRow), point(far, acrossOrigin + acrossSize), plan.version === 5 ? alongWidth ? margins.bottom : margins.right : rowMargin);
  const midRow = (firstRow + lastRow) / 2;
  add('plant-start', 'border', point(alongOrigin, midRow), point(alongStart, midRow), plan.version === 5 ? alongWidth ? margins.left : margins.top : plantMargin);
  add('plant-end', 'border', point(lastPlant, midRow), point(alongOrigin + alongSize, midRow), plan.version === 5 ? alongWidth ? margins.right : margins.bottom : plantMargin);
  for (let index = 1; index < rows; index++)
    add(`row-gap-${index}`, 'row-gap', point(centre, rowPosition(index - 1)), point(centre, rowPosition(index)), area.plant.rowSpacingCm);
  return measurements;
}

export function actualClearances(measurements: AreaMeasurement[], area: PlantingArea) {
  const sides = area.rowDirection === 'width' ? ['top', 'bottom', 'left', 'right'] : ['left', 'right', 'top', 'bottom'];
  return Object.fromEntries(['row-start', 'row-end', 'plant-start', 'plant-end'].map((id, index) => [sides[index], measurements.find((item) => item.id === id)?.distanceCm]));
}

export function visibleAreaMeasurements(all: AreaMeasurement[]): AreaMeasurement[] {
  const borders = all.filter((item) => item.kind === 'border'), gaps = all.filter((item) => item.kind === 'row-gap');
  if (gaps.length <= 4) return all;
  const min = gaps.reduce((a, b) => a.distanceCm <= b.distanceCm ? a : b);
  const max = gaps.reduce((a, b) => a.distanceCm >= b.distanceCm ? a : b);
  return [...borders, ...new Map([gaps[0], min, max, gaps.at(-1)!].map((item) => [item.id, item])).values()];
}
