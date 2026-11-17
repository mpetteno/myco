import { copyAreaPlan } from '../area-editor/areaPlan';
import type { GardenDimensions } from '../garden/garden';
import { findFreePosition } from './bed';
import type { Bed, BedCopy } from './bed';
import { canResizeBed } from './bedResize';
import { copyPlantingPlan } from '../planting/copyPlantingPlan';
import { copyMulchPlan } from '../mulch/mulchPlan';

export function getPastedBed(copied: BedCopy, garden: GardenDimensions, beds: Bed[], id: string): Bed | null {
  const baseName = `${copied.name} copy`;
  let name = baseName;
  let suffix = 2;
  while (beds.some((bed) => bed.name === name)) name = `${baseName} ${suffix++}`;

  const details = { ...copied, name };
  const position = findFreePosition(details, garden, beds);
  if (!position) return null;
  const pasted = { ...details, ...position, id,
    ...(copied.areaPlan ? { areaPlan: copyAreaPlan(copied.areaPlan) } : {}),
    ...(copied.plantingPlan ? { plantingPlan: copyPlantingPlan(copied.plantingPlan) } : {}),
    ...(copied.mulchPlan ? { mulchPlan: copyMulchPlan(copied.mulchPlan) } : {}) };
  return canResizeBed(pasted, garden, beds) ? pasted : null;
}
