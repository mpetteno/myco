import { canvasPalette } from '../appearance/canvasPalette';
import { Group, Label, Line, Tag, Text } from 'react-konva';
import type { GardenDimensions } from '../garden/garden';
import { visibleAreaMeasurements } from './areaMeasurements';
import type { AreaMeasurement } from './areaMeasurements';

type AreaRowDistanceGuidesProps = { measurements: AreaMeasurement[]; bed: GardenDimensions;
  pixelsPerCm: number; dark: boolean; viewRotationDeg: 0 | 90 };

export function AreaRowDistanceGuides({ measurements, bed, pixelsPerCm, dark, viewRotationDeg }: AreaRowDistanceGuidesProps) {
  const tick = 3 / pixelsPerCm, labelHeight = 18 / pixelsPerCm;
  const turned = viewRotationDeg === 90;
  const colors = canvasPalette(dark);
  return <Group listening={false}>
    {visibleAreaMeasurements(measurements).map((item) => {
      const { start, end, warning } = item;
      const horizontal = start.yCm === end.yCm;
      const color = warning ? colors.warning : colors.borderGuide;
      const text = `${item.distanceCm} cm${warning ? ' !' : ''}`;
      const width = (text.length * 6.5 + 10) / pixelsPerCm;
      const boxW = turned ? labelHeight : width, boxH = turned ? width : labelHeight;
      const midX = (start.xCm + end.xCm) / 2, midY = (start.yCm + end.yCm) / 2;
      const x = Math.max(0, Math.min(bed.widthCm - boxW, horizontal ? midX - boxW / 2 : midX + tick));
      const y = Math.max(0, Math.min(bed.lengthCm - boxH, horizontal ? midY - boxH - tick : midY - boxH / 2));
      return <Group key={item.id}>
        <Line points={[start.xCm, start.yCm, end.xCm, end.yCm]} stroke={color} strokeWidth={1.25 / pixelsPerCm} />
        {[start, end].map((point, index) => <Line key={index} stroke={color} strokeWidth={1.25 / pixelsPerCm}
          points={horizontal ? [point.xCm, point.yCm - tick, point.xCm, point.yCm + tick] : [point.xCm - tick, point.yCm, point.xCm + tick, point.yCm]} />)}
        <Label x={x} y={y + (turned ? width : 0)} rotation={-viewRotationDeg}>
          <Tag fill={colors.label} stroke={color} strokeWidth={0.75 / pixelsPerCm} cornerRadius={3 / pixelsPerCm} />
          <Text text={text} width={width} height={labelHeight} padding={3 / pixelsPerCm} fontSize={11 / pixelsPerCm}
            fontFamily="system-ui, sans-serif" fill={color} align="center" verticalAlign="middle" wrap="none" />
        </Label>
      </Group>;
    })}
  </Group>;
}
