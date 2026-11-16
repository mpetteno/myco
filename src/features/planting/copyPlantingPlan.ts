import type { BedPlantingPlan } from './plantingPlan';

export function copyPlantingPlan(plan: BedPlantingPlan): BedPlantingPlan {
  const copy = structuredClone(plan);
  const ids = new Map(copy.areas.map((area) => [area.id, crypto.randomUUID()]));
  return { ...copy, areas: copy.areas.map((area) => ({ ...area, id: ids.get(area.id)! })),
    advice: copy.advice.map((item) => ({ ...item, firstAreaId: ids.get(item.firstAreaId)!, secondAreaId: ids.get(item.secondAreaId)! })) };
}
