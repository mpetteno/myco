import { canvasPalette } from '../appearance/canvasPalette';
import { Group, Label, Line, Tag, Text } from 'react-konva';
import type { GardenDimensions } from '../garden/garden';
import type { Bed } from './bed';
import { getBedClearances } from './bedClearances';

type BedDistanceGuidesProps = {
  bed: Bed;
  beds: Bed[];
  garden: GardenDimensions;
  pixelsPerCm: number;
  dark: boolean;
  viewRotationDeg: 0 | 90;
};

export function BedDistanceGuides({ bed, beds, garden, pixelsPerCm, dark, viewRotationDeg }: BedDistanceGuidesProps) {
  const tickCm = 4 / pixelsPerCm;
  const labelHeightCm = 20 / pixelsPerCm;
  const turned = viewRotationDeg === 90;
  const colors = canvasPalette(dark);

  return (
    <Group listening={false}>
      {getBedClearances(bed, garden, beds).map(({ side, kind, distanceCm, start, end }) => {
        const horizontal = side === 'left' || side === 'right';
        const color = kind === 'border' ? colors.borderGuide : colors.neighbourGuide;
        const text = `${distanceCm} cm`;
        const labelWidthCm = Math.min(turned ? garden.lengthCm : garden.widthCm, (text.length * 7 + 12) / pixelsPerCm);
        // Counter-turn the text while keeping its world-space bounds inside the garden.
        const boxWidthCm = turned ? labelHeightCm : labelWidthCm;
        const boxHeightCm = turned ? labelWidthCm : labelHeightCm;
        const labelX = (start.xCm + end.xCm) / 2 + (horizontal ? -boxWidthCm / 2 : tickCm * 2);
        const labelY = (start.yCm + end.yCm) / 2 - (horizontal ? boxHeightCm + tickCm : boxHeightCm / 2);
        const xCm = Math.max(0, Math.min(garden.widthCm - boxWidthCm, labelX));
        const yCm = Math.max(0, Math.min(garden.lengthCm - boxHeightCm, labelY));

        return (
          <Group key={side}>
            <Line points={[start.xCm, start.yCm, end.xCm, end.yCm]} stroke={color} strokeWidth={1.25 / pixelsPerCm} />
            {[start, end].map((point, index) => (
              <Line key={index} stroke={color} strokeWidth={1.25 / pixelsPerCm}
                points={horizontal
                  ? [point.xCm, point.yCm - tickCm, point.xCm, point.yCm + tickCm]
                  : [point.xCm - tickCm, point.yCm, point.xCm + tickCm, point.yCm]} />
            ))}
            <Label x={xCm} y={yCm + (turned ? labelWidthCm : 0)} rotation={-viewRotationDeg}>
              <Tag fill={colors.label} stroke={color} strokeWidth={0.75 / pixelsPerCm}
                cornerRadius={3 / pixelsPerCm} />
              <Text text={text} width={labelWidthCm} height={labelHeightCm} padding={4 / pixelsPerCm}
                fontFamily="system-ui, sans-serif" fontSize={11 / pixelsPerCm} fill={color}
                align="center" verticalAlign="middle" wrap="none" ellipsis />
            </Label>
          </Group>
        );
      })}
    </Group>
  );
}
