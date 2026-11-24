import type { BedBounds } from '../beds/bed';
import type { Catalogue, PlantType, PlantCultivar } from '../catalogue/catalogue';
import { DEFAULT_BORDER_DISTANCE_CM, effectiveSpacing, effectiveCultivar, validateBorderDistanceCm } from '../catalogue/catalogue';
import type { PlantClearances } from './plantClearances';
import { validateClearances } from './plantClearances';

export const LEGACY_PLANT_EDGE_CM = 15;
export const FIXED_AREA_MARGIN_CM = 20;
export const MIN_AREA_MARGIN_CM = 15;
export const DEFAULT_AREA_ROWS = 2;
export const MAX_PLANTING_AREAS = 12;
export const MAX_PREVIEW_PLANTS = 20000;
export type RowDirection = 'width' | 'length';
export type PlantSnapshot = { id: string; name: string; familyId: string; familyName: string;
  typeVersion: number; familyVersion: number; plantSpacingCm: number | null; rowSpacingCm: number | null; borderDistanceCm?: number; cultivarId?: string; cultivarName?: string; cultivarVersion?: number };
export type PlantingArea = BedBounds & { id: string; plant: PlantSnapshot; plantSpacingCm: number;
  rowSpacingCm: number; rowDirection?: RowDirection; rowCount?: number | null; clearancesCm?: PlantClearances };
export type PlantingAdvice = { firstAreaId: string; secondAreaId: string;
  relationship: 'companion' | 'caution' | 'unknown'; notes: string };
export type BedPlantingPlan = { version: 1 | 2 | 3 | 4 | 5; rowDirection?: RowDirection; respectAreaSpacing: boolean;
  areas: PlantingArea[]; advice: PlantingAdvice[] };
export type PlantPoint = { xCm: number; yCm: number; areaIndex: number; rowIndex: number };

export const defaultRowDirection = (bed: { widthCm: number; lengthCm: number }): RowDirection => bed.widthCm >= bed.lengthCm ? 'width' : 'length';

export function editablePlantingPlan(bed: { widthCm: number; lengthCm: number }, saved?: BedPlantingPlan, preserveVersion = false): BedPlantingPlan {
  if (!saved) return { version: 5, respectAreaSpacing: true, areas: [], advice: [] };
  const copy = structuredClone(saved);
  return { version: preserveVersion ? copy.version : 5, ...(preserveVersion && copy.rowDirection ? { rowDirection: copy.rowDirection } : {}), respectAreaSpacing: copy.respectAreaSpacing, advice: copy.advice,
    areas: copy.areas.map((area) => ({ ...area, rowDirection: area.rowDirection ?? copy.rowDirection ?? defaultRowDirection(bed), rowCount: area.rowCount ?? null })) };
}

export function snapshotPlant(plant: PlantType, catalogue: Catalogue, cultivar?: PlantCultivar): PlantSnapshot {
  const family = catalogue.families.find((item) => item.id === plant.familyId)!;
  const effective = effectiveCultivar(plant, cultivar);
  return { ...(cultivar ? { cultivarId: cultivar.id, cultivarName: cultivar.name, cultivarVersion: cultivar.version } : {}), id: plant.id, name: plant.name, familyId: plant.familyId, familyName: family.name,
    typeVersion: plant.version, familyVersion: family.version, borderDistanceCm: effective.borderDistanceCm ?? DEFAULT_BORDER_DISTANCE_CM,
    ...effectiveSpacing(effective, catalogue.families) };
}

export function plantingAreasFit(plan: BedPlantingPlan | undefined, size: { widthCm: number; lengthCm: number }) {
  return !plan || plan.areas.every((area) => area.xCm >= 0 && area.yCm >= 0
    && area.xCm <= size.widthCm - area.widthCm && area.yCm <= size.lengthCm - area.lengthCm);
}

export function validatePlantingPlan(value: unknown, size: { widthCm: number; lengthCm: number }): string | null {
  if (!value || typeof value !== 'object') return 'Invalid planting plan.';
  const plan = value as BedPlantingPlan;
  if (![1, 2, 3, 4, 5].includes(plan.version) || (plan.version === 1 && !['width', 'length'].includes(plan.rowDirection ?? '')) || typeof plan.respectAreaSpacing !== 'boolean'
    || !Array.isArray(plan.areas) || plan.areas.length < 1 || plan.areas.length > MAX_PLANTING_AREAS
    || !Array.isArray(plan.advice) || plan.advice.length > 66) return 'Invalid planting plan.';
  const ids = new Set<string>();
  for (const area of plan.areas) {
    if (!area || typeof area !== 'object' || typeof area.id !== 'string' || !area.id.trim() || area.id.trim().length > 128 || ids.has(area.id)
      || ![area.xCm, area.yCm, area.widthCm, area.lengthCm].every((n) => Number.isSafeInteger(n) && n % 5 === 0)
      || area.xCm < 0 || area.yCm < 0 || area.widthCm < 5 || area.lengthCm < 5
      || ![area.plantSpacingCm, area.rowSpacingCm].every((n) => Number.isFinite(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER - 5)) return 'Check planting area dimensions and spacing.';
    if (plan.version >= 2 && (!['width', 'length'].includes(area.rowDirection ?? '')
      || (area.rowCount !== null && (!Number.isSafeInteger(area.rowCount) || area.rowCount! < 1 || area.rowCount! > MAX_PREVIEW_PLANTS)))) return 'Choose an area direction and a positive whole number of rows, or leave rows automatic.';
    const plant = area.plant;
    if (!plant || typeof plant !== 'object' || ![plant.id, plant.name, plant.familyId, plant.familyName].every((text) => typeof text === 'string' && text.trim().length > 0 && text.trim().length <= 128)
      || ![plant.typeVersion, plant.familyVersion].every((n) => Number.isSafeInteger(n) && n > 0)
      || ![plant.plantSpacingCm, plant.rowSpacingCm].every((n) => n === null || (Number.isFinite(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER))) return 'Invalid saved plant reference.';
    if (['cultivarId', 'cultivarName', 'cultivarVersion'].some((key) => key in plant) && (typeof plant.cultivarId !== 'string' || !plant.cultivarId.trim() || plant.cultivarId.length > 128 || typeof plant.cultivarName !== 'string' || !plant.cultivarName.trim() || plant.cultivarName.length > 100 || !Number.isSafeInteger(plant.cultivarVersion) || plant.cultivarVersion! < 1)) return 'Invalid saved cultivar reference.';
    if ('borderDistanceCm' in plant && validateBorderDistanceCm(plant.borderDistanceCm!)) return 'Invalid saved plant border distance.';
    const clearanceError = validateClearances(area, plan.version);
    if (clearanceError) return clearanceError;
    if (plan.areas.some((other) => other && ids.has(other.id) && area.xCm < other.xCm + other.widthCm && area.xCm + area.widthCm > other.xCm
      && area.yCm < other.yCm + other.lengthCm && area.yCm + area.lengthCm > other.yCm)) return 'Planting areas cannot overlap.';
    ids.add(area.id);
  }
  if (!plantingAreasFit(plan, size)) return 'Planting areas must stay inside the bed.';
  if (plan.advice.some((item) => !item || !ids.has(item.firstAreaId) || !ids.has(item.secondAreaId)
    || !['companion', 'caution', 'unknown'].includes(item.relationship) || typeof item.notes !== 'string' || item.notes.length > 4000)) return 'Invalid companion guidance.';
  return null;
}

export const plantLabel = (plant: Pick<PlantSnapshot, 'name' | 'cultivarName'>) => plant.cultivarName ? `${plant.name} · ${plant.cultivarName}` : plant.name;
export const plantSelectionKey = (plant: Pick<PlantSnapshot, 'id' | 'cultivarId'>) => plant.cultivarId ? `${plant.id}:${plant.cultivarId}` : plant.id;
