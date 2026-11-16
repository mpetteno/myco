import { useMemo } from 'react';
import type { Bed } from '../beds/bed';
import { previewPlanting } from './plantingGeometry';
import { PlantingMarks } from './PlantingMarks';
import { MulchMarks } from '../mulch/MulchMarks';

export function BedPlantingMarks({ bed, pixelsPerCm, dark }: { bed: Bed; pixelsPerCm: number; dark: boolean }) {
  const points = useMemo(() => bed.plantingPlan ? previewPlanting(bed.plantingPlan, bed).points : [],
    [bed.plantingPlan, bed.widthCm, bed.lengthCm]);
  return <><MulchMarks plan={bed.mulchPlan} points={points} bed={bed} pixelsPerCm={pixelsPerCm} />
    {points.length > 0 && <PlantingMarks dark={dark} points={points} pixelsPerCm={pixelsPerCm} />}</>;
}
