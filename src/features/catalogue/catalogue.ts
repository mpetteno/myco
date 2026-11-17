export type CatalogueRecord = { id: string; name: string; notes: string; version: number };
export type Spacing = { plantSpacingCm: number | null; rowSpacingCm: number | null };
export type PlantFamily = CatalogueRecord & Spacing;
export type PlantType = CatalogueRecord & Spacing & { familyId: string; borderDistanceCm: number; scientificName?: string; livingMulchEnabled?: boolean };
export const DEFAULT_BORDER_DISTANCE_CM = 15;
export type CompanionTarget = { kind: 'family' | 'plant' | 'cultivar'; id: string };
export type CompanionRule = { id: string; first: CompanionTarget; second: CompanionTarget;
  relationship: 'companion' | 'caution'; notes: string; version: number };
export type Catalogue = { families: PlantFamily[]; plants: PlantType[]; rules: CompanionRule[]; cultivars?: PlantCultivar[]; isAdmin: boolean };
export type FamilyDetails = Omit<PlantFamily, 'id' | 'version'>;
export type PlantDetails = Omit<PlantType, 'id' | 'version'>;
export type RuleDetails = Omit<CompanionRule, 'id' | 'version'>;

export const targetKey = (target: CompanionTarget) => `${target.kind}:${target.id}`;
export function orderedTargets(first: CompanionTarget, second: CompanionTarget): [CompanionTarget, CompanionTarget] {
  return targetKey(first) <= targetKey(second) ? [first, second] : [second, first];
}

export function parseSpacingCm(value: string): number | null {
  return value.trim() ? Number(value) : null;
}
export function validateSpacing(spacing: Spacing): string | null {
  return [spacing.plantSpacingCm, spacing.rowSpacingCm].every((value) => value === null
    || (Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER))
    ? null : 'Spacing must be a positive distance in cm, or left empty.';
}
export function validateDetails(details: FamilyDetails): string | null {
  if (!details.name.trim() || details.name.trim().length > 100) return 'Enter a name of 1 to 100 characters.';
  if (details.notes.length > 2000) return 'Keep notes within 2000 characters.';
  return validateSpacing(details);
}
export function validateBorderDistanceCm(value: number): string | null {
  return Number.isSafeInteger(value) && value >= 5 && value % 5 === 0
    ? null : 'Border distance must be at least 5 cm, in steps of 5 cm.';
}
export function validatePlantDetails(details: PlantDetails): string | null {
  if ((details.scientificName?.length ?? 0) > 200) return 'Keep scientific names within 200 characters.';
  return validateDetails(details) ?? (!details.familyId ? 'Choose a plant family.' : null)
    ?? validateBorderDistanceCm(details.borderDistanceCm);
}
export function effectiveSpacing(plant: PlantType, families: PlantFamily[]): Spacing {
  const family = families.find((item) => item.id === plant.familyId);
  return { plantSpacingCm: plant.plantSpacingCm ?? family?.plantSpacingCm ?? null,
    rowSpacingCm: plant.rowSpacingCm ?? family?.rowSpacingCm ?? null };
}

// Reference recommendations stay separate from future plan-specific exceptions.
export function recommendedPairSpacing(first: Spacing, second: Spacing): Spacing {
  const larger = (a: number | null, b: number | null) => a === null || b === null ? null : Math.max(a, b);
  return { plantSpacingCm: larger(first.plantSpacingCm, second.plantSpacingCm),
    rowSpacingCm: larger(first.rowSpacingCm, second.rowSpacingCm) };
}

export function companionAdvice(first: Pick<PlantType, 'id' | 'familyId'> & { cultivarId?: string }, second: Pick<PlantType, 'id' | 'familyId'> & { cultivarId?: string }, rules: CompanionRule[]) {
  const matches = (target: CompanionTarget, plant: Pick<PlantType, 'id' | 'familyId'> & { cultivarId?: string }) => target.kind === 'cultivar' ? target.id === plant.cultivarId : target.kind === 'plant'
    ? target.id === plant.id : target.id === plant.familyId;
  const matching = rules.filter((rule) => (matches(rule.first, first) && matches(rule.second, second))
    || (matches(rule.first, second) && matches(rule.second, first)));
  // A cultivar endpoint outranks even two crop endpoints.
  const specificity = (rule: CompanionRule) => ({ family: 0, plant: 1, cultivar: 3 }[rule.first.kind] + { family: 0, plant: 1, cultivar: 3 }[rule.second.kind]);
  const priority = Math.max(-1, ...matching.map(specificity));
  const applicable = matching.filter((rule) => specificity(rule) === priority);
  return { relationship: applicable.length === 0 ? 'unknown' as const
    : applicable.some((rule) => rule.relationship === 'caution') ? 'caution' as const : 'companion' as const,
  rules: applicable };
}

export type PlantCultivar = CatalogueRecord & Spacing & { plantTypeId: string; borderDistanceCm: number | null; livingMulchEnabled: boolean | null };
export function effectiveCultivar(crop: PlantType, cultivar?: PlantCultivar): PlantType {
  if (!cultivar) return crop;
  if (cultivar.plantTypeId !== crop.id) throw new Error('Cultivar does not belong to this crop.');
  return { ...crop, plantSpacingCm: cultivar.plantSpacingCm ?? crop.plantSpacingCm,
    rowSpacingCm: cultivar.rowSpacingCm ?? crop.rowSpacingCm,
    borderDistanceCm: cultivar.borderDistanceCm ?? crop.borderDistanceCm,
    livingMulchEnabled: cultivar.livingMulchEnabled ?? crop.livingMulchEnabled ?? false };
}
