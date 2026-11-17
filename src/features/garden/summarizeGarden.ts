import { savedRowPlan, validateAreaPlan, sowingQuantity, seedLabel } from '../area-editor/areaPlan';
import { plantSelectionKey, plantLabel } from '../planting/plantingPlan';
import type { Bed } from '../beds/bed';
import { previewPlanting } from '../planting/plantingGeometry';

export function getGardenRecap(beds: Bed[]) {
  const byType = new Map<string, { id: string; name: string; plants: number }>();
  const invalidBeds: string[] = [];
  const sowings: { id: string; bedName: string; name: string; quantity: number; unit: 'g' | 'seeds'; greenManure: boolean }[] = [];
  let occupiedAreaCm2 = 0, totalPlants = 0;
  for (const bed of beds) {
    occupiedAreaCm2 += bed.widthCm * bed.lengthCm;
    if (bed.areaPlan) {
      if (validateAreaPlan(bed.areaPlan, bed)) { invalidBeds.push(bed.name); continue; }
      for (const area of bed.areaPlan.areas) if (area.kind === 'broadcast') sowings.push({ id: `${bed.id}:${area.id}`, bedName: bed.name, name: seedLabel(area.sowing), quantity: sowingQuantity(area).total, unit: area.densityUnit === 'g_m2' ? 'g' : 'seeds', greenManure: area.purpose === 'green_manure' });
    }
    const plan = savedRowPlan(bed);
    if (!plan?.areas.length) continue;
    // Use the saved format, including its overrides and cross-area spacing.
    const preview = previewPlanting(plan, bed);
    if (preview.error) { invalidBeds.push(bed.name); continue; }
    totalPlants += preview.points.length;
    plan.areas.forEach((area, index) => {
      const total = byType.get(plantSelectionKey(area.plant)) ?? { id: plantSelectionKey(area.plant), name: plantLabel(area.plant), plants: 0 };
      total.plants += preview.counts[index]?.plants ?? 0;
      byType.set(plantSelectionKey(area.plant), total);
    });
  }
  return { occupiedAreaCm2, totalPlants, invalidBeds, sowings,
    plants: [...byType.values()].sort((first, second) => first.name.localeCompare(second.name)) };
}
