import { findFreePosition } from '../beds/bed';
import type { Bed } from '../beds/bed';
import { copyAreaPlan, MAX_AREAS, validateAreaPlan } from './areaPlan';
import type { BedAreaPlan, PlanArea } from './areaPlan';

export function getPastedArea(copied: PlanArea, bed: Bed, plan: BedAreaPlan): PlanArea | null {
  if (plan.areas.length >= MAX_AREAS) return null;
  const position = findFreePosition(copied, bed, plan.areas);
  if (!position) return null;
  const area = { ...copyAreaPlan({ ...plan, areas: [copied] }).areas[0], ...position };
  return validateAreaPlan({ ...plan, areas: [...plan.areas, area] }, bed) ? null : area;
}
