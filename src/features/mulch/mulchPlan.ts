import type { BedBounds } from '../beds/bed';
import type { GardenDimensions } from '../garden/garden';
import type { MulchType } from '../mulch-catalogue/mulchCatalogue';

export const PLANT_CLEARANCE_RADIUS_CM = 5;
export const MAX_MULCH_AREAS = 12;
export const MAX_MULCH_LAYERS = 8;
export type MulchLayer = { id: string; material: MulchType };
export type MulchArea = BedBounds & { id: string; name: string; layers: MulchLayer[] };
export type BedMulchPlan = { version: 1; areas: MulchArea[] };

export const mulchAreasFit = (plan: BedMulchPlan | undefined, size: GardenDimensions) => !plan || plan.areas.every((area) =>
  area.xCm >= 0 && area.yCm >= 0 && area.xCm <= size.widthCm - area.widthCm && area.yCm <= size.lengthCm - area.lengthCm);

export function validateMulchPlan(value: unknown, size: GardenDimensions): string | null {
  if (!value || typeof value !== 'object') return 'Invalid mulch plan.';
  const plan = value as BedMulchPlan;
  if (plan.version !== 1 || !Array.isArray(plan.areas) || plan.areas.length < 1 || plan.areas.length > MAX_MULCH_AREAS) return 'Use 1 to 12 mulch areas.';
  const ids = new Set<string>(), layerIds = new Set<string>();
  const validId = (id: unknown) => typeof id === 'string' && !!id.trim() && id.length <= 128;
  for (const area of plan.areas) {
    if (!area || !validId(area.id) || ids.has(area.id) || typeof area.name !== 'string' || !area.name.trim() || area.name.trim().length > 100
      || ![area.xCm, area.yCm, area.widthCm, area.lengthCm].every((n) => Number.isSafeInteger(n) && n % 5 === 0)
      || area.xCm < 0 || area.yCm < 0 || area.widthCm < 5 || area.lengthCm < 5) return 'Check mulch area names, dimensions and grid positions.';
    if (!Array.isArray(area.layers) || area.layers.length < 1 || area.layers.length > MAX_MULCH_LAYERS) return 'Each mulch area needs 1 to 8 layers.';
    for (const layer of area.layers) {
      const material = layer?.material;
      if (!layer || !validId(layer.id) || layerIds.has(layer.id) || !material || !validId(material.id)
        || typeof material.name !== 'string' || !material.name.trim() || material.name.trim().length > 100
        || typeof material.notes !== 'string' || material.notes.length > 2000 || !Number.isSafeInteger(material.version) || material.version < 1) return 'Choose a mulch type for every layer.';
      if ([material.categoryId, material.plantTypeId, material.cultivarId].some((id) => id != null && !validId(id)) || (material.cultivarId != null && material.plantTypeId == null)) return 'Invalid saved living mulch reference.';
      layerIds.add(layer.id);
    }
    if (plan.areas.some((other) => other && ids.has(other.id) && area.xCm < other.xCm + other.widthCm && area.xCm + area.widthCm > other.xCm
      && area.yCm < other.yCm + other.lengthCm && area.yCm + area.lengthCm > other.yCm)) return 'Mulch areas cannot overlap. Use layers to stack materials.';
    ids.add(area.id);
  }
  return mulchAreasFit(plan, size) ? null : 'Mulch areas must stay inside the bed.';
}

export function copyMulchPlan(plan: BedMulchPlan): BedMulchPlan {
  return { ...structuredClone(plan), areas: plan.areas.map((area) => ({ ...structuredClone(area), id: crypto.randomUUID(),
    layers: area.layers.map((layer) => ({ ...structuredClone(layer), id: crypto.randomUUID() })) })) };
}
