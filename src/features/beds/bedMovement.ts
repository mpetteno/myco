import type { GardenDimensions } from '../garden/garden';
import { snapToGridCm } from '../garden/garden';
import type { Bed } from './bed';
import { bedsOverlap, isInsideGarden } from './bed';

export type BedPosition = {
  xCm: number;
  yCm: number;
};

export function getBedMovePosition(
  bed: Bed,
  proposed: BedPosition,
  garden: GardenDimensions,
  beds: Bed[],
): BedPosition | null {
  if (!Number.isFinite(proposed.xCm) || !Number.isFinite(proposed.yCm)) return null;

  const position = {
    xCm: Math.max(0, Math.min(garden.widthCm - bed.widthCm, snapToGridCm(proposed.xCm))),
    yCm: Math.max(0, Math.min(garden.lengthCm - bed.lengthCm, snapToGridCm(proposed.yCm))),
  };
  const moved = { ...bed, ...position };
  if (!isInsideGarden(moved, garden)
    || beds.some((other) => other.id !== bed.id && bedsOverlap(moved, other))) {
    return null;
  }
  return position;
}
