import type { GardenDimensions } from '../garden/garden';
import { findFreePosition } from '../beds/bed';
import type { Bed, BedBounds } from '../beds/bed';
import type { PlantingArea } from './plantingPlan';

export const areaBeds = (areas: PlantingArea[]): Bed[] => areas.map((area, index) => ({ ...area, name: `${index + 1}. ${area.plant.name}` }));

export function freeArea(size: GardenDimensions, areas: BedBounds[]): BedBounds | null {
  const widths = [...new Set([size.widthCm, Math.max(5, Math.floor(size.widthCm / 10) * 5), Math.min(100, size.widthCm), 5])].sort((a, b) => b - a);
  const lengths = [...new Set([size.lengthCm, Math.max(5, Math.floor(size.lengthCm / 10) * 5), Math.min(100, size.lengthCm), 5])].sort((a, b) => b - a);
  const rectangles = areas.map((area, index) => ({ ...area, id: String(index), name: '' }));
  for (const widthCm of widths) for (const lengthCm of lengths) {
    const position = findFreePosition({ name: '', widthCm, lengthCm }, size, rectangles);
    if (position) return { ...position, widthCm, lengthCm };
  }
  return null;
}

export function splitArea(area: PlantingArea, id: string): [PlantingArea, PlantingArea] | null {
  const acrossWidth = area.widthCm >= area.lengthCm;
  const size = acrossWidth ? area.widthCm : area.lengthCm;
  if (size < 10) return null;
  const firstSize = Math.floor(size / 10) * 5;
  return acrossWidth
    ? [{ ...area, widthCm: firstSize }, { ...area, id, xCm: area.xCm + firstSize, widthCm: size - firstSize }]
    : [{ ...area, lengthCm: firstSize }, { ...area, id, yCm: area.yCm + firstSize, lengthCm: size - firstSize }];
}
