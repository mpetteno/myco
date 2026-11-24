import type { Bed, BedBounds } from '../beds/bed';
import { bedsOverlap } from '../beds/bed';
import type { GardenDimensions } from '../garden/garden';
import type { BedPlantingPlan, PlantingArea, PlantSnapshot } from '../planting/plantingPlan';
import { editablePlantingPlan, plantLabel, validatePlantingPlan } from '../planting/plantingPlan';
import { previewPlanting } from '../planting/plantingGeometry';
import type { BedMulchPlan, MulchLayer } from '../mulch/mulchPlan';
import { validateMulchPlan } from '../mulch/mulchPlan';
import type { SeedMixtureSnapshot } from '../seed-mixtures/seedMixture';
import { resizeAreas } from './resizeAreas';

export const MAX_AREAS = 12;
export type AreaKind = 'rows' | 'broadcast';
export type AreaPurpose = 'crop' | 'green_manure';
export type SeedSelection = { kind: 'crop'; plant: PlantSnapshot } | { kind: 'mixture'; mixture: SeedMixtureSnapshot };
type AreaBase = BedBounds & { id: string; name: string; purpose: AreaPurpose; mulch: MulchLayer[] };
export type RowArea = AreaBase & PlantingArea & { kind: 'rows' };
// seeds_m2 is retained only to read older saved plans/history. The editor uses g_m2.
export type BroadcastArea = AreaBase & { kind: 'broadcast'; sowing: SeedSelection; density: number; densityUnit: 'g_m2' | 'seeds_m2' };
// Retained for reading older snapshots; new area plans cannot create this kind.
export type UnplantedArea = AreaBase & { kind: 'unplanted' };
export type PlanArea = RowArea | BroadcastArea | UnplantedArea;
export type BedAreaPlan = { version: 1 | 2 | 3 | 4 | 5; respectAreaSpacing: boolean; areas: PlanArea[] };
export const emptyAreaPlan = (): BedAreaPlan => ({ version: 5, respectAreaSpacing: false, areas: [] });
// Display names always follow the most specific saved planting selection.
// The old name field remains in stored documents for backwards compatibility.
export function areaLabel(area: PlanArea): string {
  if (area.kind === 'rows') return area.plant.cultivarName || area.plant.name;
  if (area.kind === 'broadcast') return area.sowing.kind === 'crop'
    ? area.sowing.plant.cultivarName || area.sowing.plant.name
    : area.sowing.mixture.name || 'Choose a seed mixture';
  return 'Unplanted';
}
export const seedLabel = (selection: SeedSelection) => selection.kind === 'crop' ? plantLabel(selection.plant) : selection.mixture.name || 'Choose a seed mixture';
export const emptyMixtureSelection = (): SeedSelection => ({ kind: 'mixture', mixture: { id: '', name: '', notes: '', version: 1, components: [] } });
export function rowPlan(plan: BedAreaPlan): BedPlantingPlan {
  return { version: 5, respectAreaSpacing: plan.version >= 5 ? false : plan.respectAreaSpacing, advice: [], areas: plan.areas.filter((area): area is RowArea => area.kind === 'rows').map(({ kind, purpose, mulch, name, ...area }) => area) };
}
export function areaMulchPlan(plan: BedAreaPlan): BedMulchPlan {
  return { version: 1, areas: plan.areas.filter((area) => area.mulch.length > 0).map((area) => ({ id: area.id, name: areaLabel(area), xCm: area.xCm, yCm: area.yCm, widthCm: area.widthCm, lengthCm: area.lengthCm, layers: area.mulch })) };
}
export function areaPlanFromBed(bed: Bed): BedAreaPlan {
  if (bed.areaPlan) {
    const plan = structuredClone(bed.areaPlan);
    return { ...plan, version: 5, respectAreaSpacing: false, areas: plan.areas.map((area) => {
      if (area.kind === 'rows') return { ...area, purpose: 'crop' };
      if (area.kind === 'broadcast') {
        if (area.purpose === 'green_manure' && area.sowing.kind !== 'mixture') return { ...area, sowing: emptyMixtureSelection(), density: 0, densityUnit: 'g_m2' };
        // Seed counts cannot be converted into weight without seed-weight data.
        // Preserve the stored snapshot and require an explicit rate in grams.
        if (area.densityUnit !== 'g_m2') return { ...area, density: 0, densityUnit: 'g_m2' };
      }
      return area;
    }) };
  }
  const legacy = editablePlantingPlan(bed, bed.plantingPlan);
  const areas: PlanArea[] = legacy.areas.map((area) => ({ ...area, kind: 'rows', purpose: 'crop', name: '', mulch: [] }));
  // Legacy snapshots remain readable. Match existing covers, and retain standalone
  // covers as unplanted areas wherever their rectangles do not overlap a planting.
  for (const cover of bed.mulchPlan?.areas ?? []) {
    const same = areas.find((area) => ['xCm', 'yCm', 'widthCm', 'lengthCm'].every((key) => area[key as keyof BedBounds] === cover[key as keyof BedBounds]));
    if (same) same.mulch = structuredClone(cover.layers);
    else if (!areas.some((area) => bedsOverlap(area, cover))) areas.push({ id: cover.id, name: cover.name, kind: 'unplanted', purpose: 'crop', xCm: cover.xCm, yCm: cover.yCm, widthCm: cover.widthCm, lengthCm: cover.lengthCm, mulch: structuredClone(cover.layers) });
    else throw Error('This older layout has independent overlapping mulch areas. Clear its planting and mulch layout before editing.');
  }
  return { version: 5, respectAreaSpacing: false, areas };
}
export function savedRowPlan(bed: Bed) { return bed.areaPlan ? rowPlan(bed.areaPlan) : bed.plantingPlan; }
export function savedMulchPlan(bed: Bed) { return bed.areaPlan ? areaMulchPlan(bed.areaPlan) : bed.mulchPlan; }
export function areasFit(plan: BedAreaPlan | undefined, bed: GardenDimensions) {
  return !plan || plan.areas.every((area) => area.xCm >= 0 && area.yCm >= 0 && area.xCm + area.widthCm <= bed.widthCm && area.yCm + area.lengthCm <= bed.lengthCm);
}
function validPlant(plant: PlantSnapshot, bed: GardenDimensions) {
  if (!plant || typeof plant !== 'object') return false;
  const area: PlantingArea = { id: 'reference', xCm: 0, yCm: 0, widthCm: Math.max(5, bed.widthCm), lengthCm: Math.max(5, bed.lengthCm), plant, plantSpacingCm: 5, rowSpacingCm: 5, rowDirection: 'length', rowCount: 1 };
  return !validatePlantingPlan({ version: 5, respectAreaSpacing: true, areas: [area], advice: [] }, bed);
}
export function validateAreaPlan(value: unknown, bed: GardenDimensions): string | null {
  if (!value || typeof value !== 'object') return 'Invalid area plan.';
  const plan = value as BedAreaPlan;
  if (![1, 2, 3, 4, 5].includes(plan.version) || typeof plan.respectAreaSpacing !== 'boolean' || !Array.isArray(plan.areas) || plan.areas.length > MAX_AREAS) return 'Use up to 12 areas per bed.';
  if (plan.version >= 5 && plan.respectAreaSpacing !== false) return 'Each area uses its own row and border spacing.';
  const ids = new Set<string>(), layerIds = new Set<string>();
  for (const area of plan.areas) {
    if (!area || typeof area.id !== 'string' || !area.id.trim() || area.id.length > 128 || ids.has(area.id) || typeof area.name !== 'string' || area.name.length > 100
      || !['crop', 'green_manure'].includes(area.purpose) || !['rows', 'broadcast', 'unplanted'].includes(area.kind)
      || ![area.xCm, area.yCm, area.widthCm, area.lengthCm].every((n) => Number.isSafeInteger(n) && n % 5 === 0) || area.xCm < 0 || area.yCm < 0 || area.widthCm < 5 || area.lengthCm < 5) return 'Check area names, dimensions, purpose and grid positions.';
    if (plan.version >= 2 && area.kind === 'unplanted') return 'Choose Plant rows or Broadcast sowing for this area.';
    if (plan.version >= 2 && area.kind === 'rows' && area.purpose !== 'crop') return 'Plant rows are only available for Harvest crop.';
    if ('clearancesCm' in area && area.clearancesCm !== undefined && (plan.version !== 5 || area.kind !== 'rows')) return 'Plant clearances apply to format-5 row areas only.';
    if (plan.version >= 3 && area.purpose === 'green_manure' && (area.kind !== 'broadcast' || area.sowing?.kind !== 'mixture' || !area.sowing.mixture.id)) return 'Choose a seed mixture for Green manure.';
    if (plan.version >= 4 && area.kind === 'broadcast') {
      if (area.purpose === 'crop' && (area.sowing?.kind !== 'crop' || !area.sowing.plant?.id)) return 'Choose a crop for Harvest crop. Seed mixtures are only available for Green manure.';
      if (area.densityUnit !== 'g_m2') return 'Broadcast sowing uses grams per m².';
    }
    if (plan.areas.some((other) => other && ids.has(other.id) && bedsOverlap(area, other))) return 'Areas cannot overlap.';
    if (!Array.isArray(area.mulch) || area.mulch.length > 8) return 'Use up to 8 mulch layers per area.';
    if (area.mulch.length) {
      const error = validateMulchPlan({ version: 1, areas: [{ id: area.id, name: area.name.trim() || 'Area', xCm: area.xCm, yCm: area.yCm, widthCm: area.widthCm, lengthCm: area.lengthCm, layers: area.mulch }] }, bed);
      if (error) return error;
      for (const layer of area.mulch) { if (layerIds.has(layer.id)) return 'Mulch layer identifiers must be unique.'; layerIds.add(layer.id); }
    }
    if (area.kind === 'broadcast') {
      if (!Number.isFinite(area.density) || area.density <= 0 || area.density > 1000000 || !['g_m2', 'seeds_m2'].includes(area.densityUnit)) return 'Enter a sowing density above 0 and at most 1,000,000 per m².';
      if (area.sowing?.kind === 'crop') { if (!validPlant(area.sowing.plant, bed)) return 'Choose a crop or cultivar for broadcast sowing.'; }
      else if (area.sowing?.kind === 'mixture') {
        const mixture = area.sowing.mixture;
        if (area.densityUnit !== 'g_m2') return 'Seed mixtures use grams per m² because their composition is by weight.';
        if (!mixture || typeof mixture.id !== 'string' || !mixture.id.trim() || mixture.id.length > 128 || typeof mixture.name !== 'string' || !mixture.name.trim() || mixture.name.length > 100 || typeof mixture.notes !== 'string' || mixture.notes.length > 2000 || !Number.isSafeInteger(mixture.version) || mixture.version < 1 || !Array.isArray(mixture.components) || !mixture.components.length || mixture.components.length > 50) return 'Invalid saved seed mixture.';
        const components = new Set<string>();
        for (const component of mixture.components) {
          if (!component || !validPlant(component.plant, bed) || !Number.isFinite(component.percentage) || component.percentage <= 0 || component.percentage > 100) return 'Invalid mixture component.';
          const key = `${component.plant.id}:${component.plant.cultivarId ?? ''}`;
          if (components.has(key)) return 'Mixture components must be unique.';
          components.add(key);
        }
        if (Math.abs(mixture.components.reduce((sum, item) => sum + item.percentage, 0) - 100) > 0.000001) return 'Mixture percentages must total 100%.';
      } else return 'Choose a crop or seed mixture.';
    }
    ids.add(area.id);
  }
  if (!areasFit(plan, bed)) return 'Areas must stay inside the bed.';
  const rows = rowPlan(plan);
  if (rows.areas.length) {
    const preview = previewPlanting(rows, bed);
    if (preview.error) return preview.error;
    if (!preview.points.length) return 'No plants fit the row areas. Adjust size or spacing.';
  }
  return null;
}
export function sowingQuantity(area: BroadcastArea) {
  const total = area.density * area.widthCm * area.lengthCm / 10000;
  return { total: area.densityUnit === 'seeds_m2' ? Math.ceil(total) : total,
    components: area.sowing.kind === 'mixture' ? area.sowing.mixture.components.map((item) => ({ name: plantLabel(item.plant), grams: total * item.percentage / 100 })) : [] };
}
export function resizePlanAreas(plan: BedAreaPlan, id: string, bounds: BedBounds, bed: GardenDimensions) {
  const areas = resizeAreas(plan.areas, id, bounds, bed);
  if (!areas) return null;
  const projected = rowPlan({ ...plan, areas });
  if (!projected.areas.length) return areas;
  const preview = previewPlanting(projected, bed);
  return preview.error || preview.counts.some((item) => !item.plants) ? null : areas;
}
export function copyAreaPlan(plan: BedAreaPlan): BedAreaPlan {
  const copy = structuredClone(plan);
  copy.areas = copy.areas.map((area) => ({ ...area, id: crypto.randomUUID(), mulch: area.mulch.map((layer) => ({ ...layer, id: crypto.randomUUID() })) }));
  return copy;
}
