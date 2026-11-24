import type { PlantingArea } from './plantingPlan';

export const clearanceSides = ['top', 'right', 'bottom', 'left'] as const;
export type ClearanceSide = typeof clearanceSides[number];
export type PlantClearances = Partial<Record<ClearanceSide, number>>;

export const cropMinimumClearance = (area: PlantingArea) => area.plant.borderDistanceCm ?? 15;
export function effectiveClearances(area: PlantingArea): Record<ClearanceSide, number> {
  const minimum = cropMinimumClearance(area);
  return Object.fromEntries(clearanceSides.map((side) => [side, area.clearancesCm?.[side] ?? minimum])) as Record<ClearanceSide, number>;
}

export function validateClearances(area: PlantingArea, version: number): string | null {
  if (area.clearancesCm === undefined) return null;
  const values = area.clearancesCm, minimum = cropMinimumClearance(area);
  if (version !== 5 || !values || typeof values !== 'object' || Array.isArray(values)
    || Object.keys(values).some((key) => !clearanceSides.includes(key as ClearanceSide))
    || Object.values(values).some((value) => !Number.isSafeInteger(value) || value < minimum || value % 5 !== 0))
    return `Minimum clearances must use multiples of 5 cm and be at least the saved crop minimum (${minimum} cm).`;
  return null;
}
