import type { GardenDimensions } from '../garden/garden';
import type { Bed } from './bed';

export type BedAlignment = {
  axis: 'vertical' | 'horizontal';
  positionCm: number;
};

export function getBedAlignments(bed: Bed, garden: GardenDimensions, beds: Bed[]): BedAlignment[] {
  const alignments: BedAlignment[] = [];
  const references = [
    { id: 'garden-border', xCm: 0, yCm: 0, ...garden },
    ...beds.filter((other) => other.id !== bed.id),
  ];

  for (const axis of ['vertical', 'horizontal'] as const) {
    const start = axis === 'vertical' ? bed.xCm : bed.yCm;
    const size = axis === 'vertical' ? bed.widthCm : bed.lengthCm;
    const positions = new Set<number>();
    for (const reference of references) {
      const otherStart = axis === 'vertical' ? reference.xCm : reference.yCm;
      const otherSize = axis === 'vertical' ? reference.widthCm : reference.lengthCm;
      for (const edge of [start, start + size]) {
        if (edge === otherStart || edge === otherStart + otherSize) positions.add(edge);
      }
      if (start + size / 2 === otherStart + otherSize / 2) positions.add(start + size / 2);
    }
    for (const positionCm of positions) alignments.push({ axis, positionCm });
  }
  return alignments;
}
