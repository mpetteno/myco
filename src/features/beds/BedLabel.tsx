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
  // A long name must not push the size badge beyond the drawing on phones.
  // Keep the full name in the accessible canvas description and selected-bed toolbar.
  const availablePx = Math.max(80, Math.max(bed.widthCm, bed.lengthCm) * pixelsPerCm - 12);
  const inline = availablePx >= measured.sizeWidthPx + 88;
  const nameWidthCm = Math.min(measured.nameWidthPx + 8, inline ? availablePx - measured.sizeWidthPx - 8 : availablePx) / pixelsPerCm;
  const sizeWidthCm = measured.sizeWidthPx / pixelsPerCm;
  const gapCm = 8 / pixelsPerCm;
  const heightCm = 22 / pixelsPerCm;
  const totalWidthCm = inline ? nameWidthCm + gapCm + sizeWidthCm : Math.max(nameWidthCm, sizeWidthCm);
  const badgeX = inline ? nameWidthCm + gapCm : (totalWidthCm - sizeWidthCm) / 2;
  const badgeY = inline ? 0 : heightCm;

  return (
    <Group x={bed.xCm + bed.widthCm / 2} y={bed.yCm + bed.lengthCm / 2}
      rotation={bed.lengthCm > bed.widthCm ? -90 : 0} listening={false}>
      <Group x={-totalWidthCm / 2} y={-(inline ? heightCm : heightCm * 2) / 2}>
        <Text text={bed.name} width={nameWidthCm + 1 / pixelsPerCm} height={heightCm}
          fontSize={13 / pixelsPerCm} fontFamily="system-ui, sans-serif"
          fill={colors.name} stroke={colors.nameOutline} strokeWidth={2 / pixelsPerCm} fillAfterStrokeEnabled
          verticalAlign="middle" wrap="none" ellipsis />
        <Rect x={badgeX} y={badgeY} width={sizeWidthCm} height={heightCm}
          fill={colors.label} stroke={colors.bedBorder}
          strokeWidth={0.75 / pixelsPerCm} cornerRadius={4 / pixelsPerCm} />
        <Text x={badgeX} y={badgeY} text={size} width={sizeWidthCm} height={heightCm}
          fontSize={11 / pixelsPerCm} fontFamily="system-ui, sans-serif"
          fill={colors.labelText} align="center" verticalAlign="middle" wrap="none" />
      </Group>
    </Group>
  );
}
