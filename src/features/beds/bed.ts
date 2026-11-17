import type { BedAreaPlan } from '../area-editor/areaPlan';
import type { GardenDimensions } from '../garden/garden';
import type { BedPlantingPlan } from '../planting/plantingPlan';
import type { BedMulchPlan } from '../mulch/mulchPlan';

export type BedPlans = { areaPlan?: BedAreaPlan; plantingPlan?: BedPlantingPlan; mulchPlan?: BedMulchPlan };

export type BedDetails = GardenDimensions & {
  name: string;
};

export type BedBounds = GardenDimensions & {
  xCm: number;
  yCm: number;
};

export type Bed = BedDetails & BedBounds & BedPlans & {
  id: string;
};
export type BedCopy = BedDetails & BedPlans;

export function isInsideGarden(bed: Bed, garden: GardenDimensions) {
  return bed.xCm >= 0 && bed.yCm >= 0
    && bed.xCm <= garden.widthCm - bed.widthCm
    && bed.yCm <= garden.lengthCm - bed.lengthCm;
}

export function bedsOverlap(a: BedBounds, b: BedBounds) {
  return a.xCm < b.xCm + b.widthCm && a.xCm + a.widthCm > b.xCm
    && a.yCm < b.yCm + b.lengthCm && a.yCm + a.lengthCm > b.yCm;
}

export function findFreePosition(details: BedDetails, garden: GardenDimensions, beds: Bed[]) {
  // The first free position must start at the origin or at an existing bed's edge.
  // Checking those edges avoids scanning every 5 cm cell of a large garden.
  const xPositions = [...new Set([0, ...beds.map((bed) => bed.xCm + bed.widthCm)])].sort((a, b) => a - b);
  const yPositions = [...new Set([0, ...beds.map((bed) => bed.yCm + bed.lengthCm)])].sort((a, b) => a - b);

  for (const yCm of yPositions) {
    for (const xCm of xPositions) {
      const candidate: Bed = { ...details, id: '', xCm, yCm };
      if (isInsideGarden(candidate, garden) && !beds.some((bed) => bedsOverlap(candidate, bed))) {
        return { xCm, yCm };
      }
    }
  }
  return null;
}
