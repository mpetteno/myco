import { useRef } from 'react';
import type { Bed } from '../beds/bed';
import type { BedAreaPlan, PlanArea } from './areaPlan';
import { getPastedArea } from './areaClipboard';

// Lives with the garden so areas can be copied between its bed editors.
export function useAreaClipboard() {
  const copied = useRef<PlanArea | null>(null);
  return {
    copy: (area: PlanArea) => { copied.current = structuredClone(area); },
    hasCopy: () => copied.current !== null,
    paste: (bed: Bed, plan: BedAreaPlan) => copied.current ? getPastedArea(copied.current, bed, plan) : null,
  };
}
export type AreaClipboard = ReturnType<typeof useAreaClipboard>;
