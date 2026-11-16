import type { GardenDimensions } from '../garden/garden';
import type { Bed } from './bed';

type PointCm = { xCm: number; yCm: number };

export type BedClearance = {
  side: 'left' | 'right' | 'top' | 'bottom';
  kind: 'border' | 'bed';
  target: string;
  distanceCm: number;
  start: PointCm;
  end: PointCm;
};

export function getBedClearances(bed: Bed, garden: GardenDimensions, beds: Bed[]): BedClearance[] {
  const rightCm = bed.xCm + bed.widthCm;
  const bottomCm = bed.yCm + bed.lengthCm;
  const midX = bed.xCm + bed.widthCm / 2;
  const midY = bed.yCm + bed.lengthCm / 2;
  const guides: BedClearance[] = [
    { side: 'left', kind: 'border', target: 'Garden border', distanceCm: bed.xCm,
      start: { xCm: 0, yCm: midY }, end: { xCm: bed.xCm, yCm: midY } },
    { side: 'right', kind: 'border', target: 'Garden border', distanceCm: garden.widthCm - rightCm,
      start: { xCm: rightCm, yCm: midY }, end: { xCm: garden.widthCm, yCm: midY } },
    { side: 'top', kind: 'border', target: 'Garden border', distanceCm: bed.yCm,
      start: { xCm: midX, yCm: 0 }, end: { xCm: midX, yCm: bed.yCm } },
    { side: 'bottom', kind: 'border', target: 'Garden border', distanceCm: garden.lengthCm - bottomCm,
      start: { xCm: midX, yCm: bottomCm }, end: { xCm: midX, yCm: garden.lengthCm } },
  ];

  function useCloser(index: number, other: Bed, start: PointCm, end: PointCm) {
    const distanceCm = Math.abs(end.xCm - start.xCm) + Math.abs(end.yCm - start.yCm);
    if (distanceCm < guides[index].distanceCm) {
      guides[index] = { ...guides[index], kind: 'bed', target: other.name, distanceCm, start, end };
    }
  }

  for (const other of beds) {
    if (other.id === bed.id) continue;
    const otherRight = other.xCm + other.widthCm;
    const otherBottom = other.yCm + other.lengthCm;
    const sharedTop = Math.max(bed.yCm, other.yCm);
    const sharedBottom = Math.min(bottomCm, otherBottom);
    const sharedLeft = Math.max(bed.xCm, other.xCm);
    const sharedRight = Math.min(rightCm, otherRight);

    // A side gap is measured only where the two beds face one another.
    if (sharedTop < sharedBottom) {
      const yCm = (sharedTop + sharedBottom) / 2;
      if (otherRight <= bed.xCm) useCloser(0, other, { xCm: otherRight, yCm }, { xCm: bed.xCm, yCm });
      if (other.xCm >= rightCm) useCloser(1, other, { xCm: rightCm, yCm }, { xCm: other.xCm, yCm });
    }
    if (sharedLeft < sharedRight) {
      const xCm = (sharedLeft + sharedRight) / 2;
      if (otherBottom <= bed.yCm) useCloser(2, other, { xCm, yCm: otherBottom }, { xCm, yCm: bed.yCm });
      if (other.yCm >= bottomCm) useCloser(3, other, { xCm, yCm: bottomCm }, { xCm, yCm: other.yCm });
    }
  }
  return guides;
}
