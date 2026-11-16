import { useMemo } from 'react';
import { Shape } from 'react-konva';
import type { GardenDimensions } from '../garden/garden';
import type { PlantPoint } from '../planting/plantingPlan';
import type { BedMulchPlan } from './mulchPlan';
import type { BedBounds } from '../beds/bed';
import { createMulchSurface } from './mulchRendering';
import type { MulchLayerPreview } from './mulchRendering';

export function MulchMarks({ plan, points, bed, pixelsPerCm, preview = null, bounds }: { plan?: BedMulchPlan; points: PlantPoint[];
  bed: GardenDimensions; pixelsPerCm: number; preview?: MulchLayerPreview; bounds?: BedBounds }) {
  const surface = useMemo(() => plan?.areas.length ? createMulchSurface(plan, points, bed, pixelsPerCm, preview,bounds) : null,
    [plan, points, bed.widthCm, bed.lengthCm, pixelsPerCm, preview,bounds]);
  return surface ? <Shape listening={false} sceneFunc={(context) => context.drawImage(surface,bounds?.xCm ?? 0,bounds?.yCm ?? 0,bounds?.widthCm ?? bed.widthCm,bounds?.lengthCm ?? bed.lengthCm)} /> : null;
}
