import { savedRowPlan, savedMulchPlan } from '../area-editor/areaPlan';
import { AreaSurfaceMarks } from '../area-editor/AreaSurfaceMarks';
import { useMemo } from 'react';
import type { Bed } from '../beds/bed';
import { previewPlanting } from './plantingGeometry';
import { PlantingMarks } from './PlantingMarks';
import { MulchMarks } from '../mulch/MulchMarks';

export function BedPlantingMarks({ bed, pixelsPerCm, dark }: { bed: Bed; pixelsPerCm: number; dark: boolean }) {
  const points = useMemo(() => { const plan = savedRowPlan(bed); return plan?.areas.length ? previewPlanting(plan, bed).points : []; },
    [bed.areaPlan, bed.plantingPlan, bed.widthCm, bed.lengthCm]);
  return <><AreaSurfaceMarks plan={bed.areaPlan} pixelsPerCm={pixelsPerCm} dark={dark} /><MulchMarks plan={savedMulchPlan(bed)} points={points} bed={bed} pixelsPerCm={pixelsPerCm} />
    {points.length > 0 && <PlantingMarks dark={dark} points={points} pixelsPerCm={pixelsPerCm} />}</>;
}
