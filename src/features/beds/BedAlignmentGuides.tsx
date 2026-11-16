import { Group, Line } from 'react-konva';
import type { GardenDimensions } from '../garden/garden';
import type { Bed } from './bed';
import { getBedAlignments } from './bedAlignments';

type BedAlignmentGuidesProps = {
  bed: Bed;
  beds: Bed[];
  garden: GardenDimensions;
  pixelsPerCm: number;
  dark: boolean;
};

export function BedAlignmentGuides({ bed, beds, garden, pixelsPerCm, dark }: BedAlignmentGuidesProps) {
  return (
    <Group listening={false}>
      {getBedAlignments(bed, garden, beds).map(({ axis, positionCm }) => (
        <Line key={`${axis}-${positionCm}`}
          points={axis === 'vertical'
            ? [positionCm, 0, positionCm, garden.lengthCm]
            : [0, positionCm, garden.widthCm, positionCm]}
          stroke={dark ? '#e879f9' : '#a21caf'} strokeWidth={1.5 / pixelsPerCm}
          dash={[6 / pixelsPerCm, 4 / pixelsPerCm]} />
      ))}
    </Group>
  );
}
