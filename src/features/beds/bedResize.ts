import { GRID_SIZE_CM, snapToGridCm } from '../garden/garden';
import type { GardenDimensions } from '../garden/garden';
import { bedsOverlap, isInsideGarden } from './bed';
import type { Bed } from './bed';
import type { BedPosition } from './bedMovement';

export const RESIZE_HANDLES = [
  'top-left', 'top-middle', 'top-right', 'middle-left',
  'middle-right', 'bottom-left', 'bottom-middle', 'bottom-right',
] as const;

export type ResizeHandle = typeof RESIZE_HANDLES[number];

export function getResizeHandlePosition(bed: Bed, handle: ResizeHandle): BedPosition {
  return {
    xCm: bed.xCm + (handle.includes('left') ? 0 : handle.includes('right') ? bed.widthCm : bed.widthCm / 2),
    yCm: bed.yCm + (handle.includes('top') ? 0 : handle.includes('bottom') ? bed.lengthCm : bed.lengthCm / 2),
  };
}

export function canResizeBed(bed: Bed, garden: GardenDimensions, beds: Bed[]) {
  const values = [bed.xCm, bed.yCm, bed.widthCm, bed.lengthCm];
  return values.every((value) => Number.isSafeInteger(value) && value % GRID_SIZE_CM === 0)
    && bed.widthCm >= GRID_SIZE_CM && bed.lengthCm >= GRID_SIZE_CM
    && isInsideGarden(bed, garden)
    && !beds.some((other) => other.id !== bed.id && bedsOverlap(bed, other));
}

export function getResizedBed(
  original: Bed, handle: ResizeHandle, pointer: BedPosition,
  garden: GardenDimensions, beds: Bed[],
): Bed | null {
  if (!Number.isFinite(pointer.xCm) || !Number.isFinite(pointer.yCm)) return null;
  let leftCm = original.xCm;
  let topCm = original.yCm;
  let rightCm = leftCm + original.widthCm;
  let bottomCm = topCm + original.lengthCm;

  if (handle.includes('left')) leftCm = Math.max(0, Math.min(rightCm - GRID_SIZE_CM, snapToGridCm(pointer.xCm)));
  if (handle.includes('right')) rightCm = Math.min(garden.widthCm, Math.max(leftCm + GRID_SIZE_CM, snapToGridCm(pointer.xCm)));
  if (handle.includes('top')) topCm = Math.max(0, Math.min(bottomCm - GRID_SIZE_CM, snapToGridCm(pointer.yCm)));
  if (handle.includes('bottom')) bottomCm = Math.min(garden.lengthCm, Math.max(topCm + GRID_SIZE_CM, snapToGridCm(pointer.yCm)));

  const resized = {
    ...original, xCm: leftCm, yCm: topCm,
    widthCm: rightCm - leftCm, lengthCm: bottomCm - topCm,
  };
  return canResizeBed(resized, garden, beds) ? resized : null;
}
