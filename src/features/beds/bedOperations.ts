import type { GardenDimensions } from '../garden/garden';
import { findFreePosition } from './bed';
import type { Bed, BedDetails } from './bed';
import { canResizeBed } from './bedResize';

export function getPastedBed(copied: BedDetails, garden: GardenDimensions, beds: Bed[], id: string): Bed | null {
  const baseName = `${copied.name} copy`;
  let name = baseName;
  let suffix = 2;
  while (beds.some((bed) => bed.name === name)) name = `${baseName} ${suffix++}`;

  const details = { ...copied, name };
  const position = findFreePosition(details, garden, beds);
  if (!position) return null;
  const pasted = { ...details, ...position, id };
  return canResizeBed(pasted, garden, beds) ? pasted : null;
}
