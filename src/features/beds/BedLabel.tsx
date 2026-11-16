import { canvasPalette } from '../appearance/canvasPalette';
import { useMemo } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { Bed } from './bed';

type BedLabelProps = {
  bed: Bed;
  pixelsPerCm: number;
  dark: boolean;
};

export function BedLabel({ bed, pixelsPerCm, dark }: BedLabelProps) {
  const colors = canvasPalette(dark);
  const size = `${bed.widthCm} × ${bed.lengthCm} cm`;
  const measured = useMemo(() => {
    const context = document.createElement('canvas').getContext('2d')!;
    context.font = '13px system-ui, sans-serif';
    const nameWidthPx = context.measureText(bed.name).width;
    context.font = '11px system-ui, sans-serif';
    return { nameWidthPx, sizeWidthPx: context.measureText(size).width + 12 };
  }, [bed.name, size]);
  const nameWidthCm = measured.nameWidthPx / pixelsPerCm;
  const sizeWidthCm = measured.sizeWidthPx / pixelsPerCm;
  const gapCm = 8 / pixelsPerCm;
  const heightCm = 22 / pixelsPerCm;
  const totalWidthCm = nameWidthCm + gapCm + sizeWidthCm;

  return (
    <Group x={bed.xCm + bed.widthCm / 2} y={bed.yCm + bed.lengthCm / 2}
      rotation={bed.lengthCm > bed.widthCm ? -90 : 0} listening={false}>
      <Group x={-totalWidthCm / 2} y={-heightCm / 2}>
        <Text text={bed.name} width={nameWidthCm + 1 / pixelsPerCm} height={heightCm}
          fontSize={13 / pixelsPerCm} fontFamily="system-ui, sans-serif"
          fill={colors.name} stroke={colors.nameOutline} strokeWidth={2 / pixelsPerCm} fillAfterStrokeEnabled
          verticalAlign="middle" wrap="none" />
        <Rect x={nameWidthCm + gapCm} width={sizeWidthCm} height={heightCm}
          fill={colors.label} stroke={colors.bedBorder}
          strokeWidth={0.75 / pixelsPerCm} cornerRadius={4 / pixelsPerCm} />
        <Text x={nameWidthCm + gapCm} text={size} width={sizeWidthCm} height={heightCm}
          fontSize={11 / pixelsPerCm} fontFamily="system-ui, sans-serif"
          fill={colors.labelText} align="center" verticalAlign="middle" wrap="none" />
      </Group>
    </Group>
  );
}
