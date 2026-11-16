export const GRID_SIZE_CM = 5;

export type GardenDimensions = {
  widthCm: number;
  lengthCm: number;
};

export function snapToGridCm(valueCm: number) {
  return Math.round(valueCm / GRID_SIZE_CM) * GRID_SIZE_CM;
}

export function parseDimensionCm(value: string): number | null {
  const valueCm = Number(value);
  const snappedCm = snapToGridCm(valueCm);
  if (!Number.isFinite(valueCm) || valueCm < GRID_SIZE_CM || !Number.isSafeInteger(snappedCm)) {
    return null;
  }
  return snappedCm;
}
