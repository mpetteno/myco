import type { RotationRule } from '../catalogue-reference/referenceModel';
import type { PlantSnapshot } from '../planting/plantingPlan';

type RotationPlant = Pick<PlantSnapshot, 'id' | 'familyId' | 'cultivarId'>;
export const automaticFamilyPredecessor = (familyId: string | undefined) => familyId?.trim() ? `family:${familyId}` : undefined;

// Explicit rules always take precedence over the calculated family fallback.
// Preserve the existing specificity weights and caution-first tie breaking.
export function rotationAdvice(current: RotationPlant, previous: RotationPlant, rules: RotationRule[]) {
  const matches = (rule: RotationRule, prefix: 'current' | 'previous', plant: RotationPlant) => rule[`${prefix}_cultivar_id`]
    ? rule[`${prefix}_cultivar_id`] === plant.cultivarId : rule[`${prefix}_plant_id`]
      ? rule[`${prefix}_plant_id`] === plant.id : rule[`${prefix}_family_id`] === plant.familyId;
  const score = (rule: RotationRule) => (rule.current_cultivar_id ? 3 : rule.current_plant_id ? 1 : 0)
    + (rule.previous_cultivar_id ? 3 : rule.previous_plant_id ? 1 : 0);
  const matching = rules.filter((rule) => matches(rule, 'current', current) && matches(rule, 'previous', previous));
  const priority = Math.max(-1, ...matching.map(score));
  const applicable = matching.filter((rule) => score(rule) === priority);
  const automatic = !applicable.length && !!automaticFamilyPredecessor(current.familyId) && current.familyId === previous.familyId;
  const relationship = applicable.some((rule) => rule.relationship === 'avoid_after') || automatic ? 'avoid_after'
    : applicable.length ? 'favourable_after' : 'unknown';
  return { rules: applicable, relationship, automatic } as const;
}
