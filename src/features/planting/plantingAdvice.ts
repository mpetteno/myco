import { companionAdvice } from '../catalogue/catalogue';
import type { Catalogue } from '../catalogue/catalogue';
import type { BedPlantingPlan, PlantingAdvice } from './plantingPlan';

export function planAdvice(plan: BedPlantingPlan, catalogue: Catalogue): PlantingAdvice[] {
  const advice: PlantingAdvice[] = [];
  for (let i = 0; i < plan.areas.length; i++) for (let j = i + 1; j < plan.areas.length; j++) {
    const first = plan.areas[i], second = plan.areas[j];
    const result = companionAdvice(first.plant, second.plant, catalogue.rules);
    advice.push({ firstAreaId: first.id, secondAreaId: second.id, relationship: result.relationship,
      notes: result.rules.map((rule) => rule.notes).filter(Boolean).join('\n').slice(0, 4000) });
  }
  return advice;
}
