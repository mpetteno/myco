import type { BedPlantingPlan } from '../planting/plantingPlan';
import type { BedPlans } from '../beds/bed';

export function bedPlanDraftKey(plans: BedPlans): string {
  const planting = plantingDraftKey(plans.plantingPlan);
  const mulch = plans.mulchPlan?.areas.length ? JSON.stringify(plans.mulchPlan) : '';
  return planting || mulch ? JSON.stringify([planting, mulch]) : '';
}

// Companion advice is refreshed separately; compare the choices that move plants.
export function plantingDraftKey(plan: BedPlantingPlan | undefined): string {
  if (!plan?.areas.length) return '';
  return JSON.stringify({ version: plan.version, rowDirection: plan.rowDirection, respectAreaSpacing: plan.respectAreaSpacing,
    areas: plan.areas.map((area) => ({ id: area.id, xCm: area.xCm, yCm: area.yCm,
      widthCm: area.widthCm, lengthCm: area.lengthCm, plant: area.plant,
      plantSpacingCm: area.plantSpacingCm, rowSpacingCm: area.rowSpacingCm,
      rowDirection: area.rowDirection, rowCount: area.rowCount })) });
}
