import type { Bed } from '../beds/bed';
import { previewPlanting } from '../planting/plantingGeometry';

export function getGardenRecap(beds: Bed[]) {
  const byType = new Map<string, { id: string; name: string; plants: number }>();
  const invalidBeds: string[] = [];
  let occupiedAreaCm2 = 0, totalPlants = 0;
  for (const bed of beds) {
    occupiedAreaCm2 += bed.widthCm * bed.lengthCm;
    if (!bed.plantingPlan) continue;
    // Use the saved format, including its overrides and cross-area spacing.
    const preview = previewPlanting(bed.plantingPlan, bed);
    if (preview.error) { invalidBeds.push(bed.name); continue; }
    totalPlants += preview.points.length;
    bed.plantingPlan.areas.forEach((area, index) => {
      const total = byType.get(area.plant.id) ?? { id: area.plant.id, name: area.plant.name, plants: 0 };
      total.plants += preview.counts[index]?.plants ?? 0;
      byType.set(area.plant.id, total);
    });
  }
  return { occupiedAreaCm2, totalPlants, invalidBeds,
    plants: [...byType.values()].sort((first, second) => first.name.localeCompare(second.name)) };
}
