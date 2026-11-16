import type { Bed } from '../beds/bed';
import { freeArea } from '../planting/plantingAreas';
import type { MulchArea, MulchLayer } from './mulchPlan';
import type { GardenDimensions } from '../garden/garden';

export const mulchAreaBeds = (areas: MulchArea[]): Bed[] => areas.map(({ layers: _, ...area }) => area);

export function freeMulchArea(size: GardenDimensions, areas: MulchArea[]) {
  // Reuse the free-rectangle search; planting and mulch have separate occupancy.
  return freeArea(size, areas);
}

export function reorderMulchLayer(layers: MulchLayer[], id: string, direction: -1 | 1) {
  const index = layers.findIndex((layer) => layer.id === id), nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= layers.length) return layers;
  const next = [...layers];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}
