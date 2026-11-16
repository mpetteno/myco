import { useMemo } from 'react';
import { Shape } from 'react-konva';
import { GRID_SIZE_CM } from './garden';
import type { GardenDimensions } from './garden';

type GardenGridProps = GardenDimensions & {
  pixelsPerCm: number;
  dark: boolean;
};

export function GardenGrid({ widthCm, lengthCm, pixelsPerCm, dark }: GardenGridProps) {
  const tile = useMemo(() => {
    // A repeating tile keeps the grid cheap even for large gardens.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.fillStyle = dark ? '#163b28' : '#dcebd5';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = dark ? '#356348' : '#abc69f';
    context.lineWidth = Math.min(16, 0.6 * canvas.width / (GRID_SIZE_CM * pixelsPerCm));
    context.strokeRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }, [pixelsPerCm, dark]);

  return (
    <Shape
      width={widthCm}
      height={lengthCm}
      listening={false}
      sceneFunc={(context) => {
        const pattern = context.createPattern(tile, 'repeat');
        if (!pattern) return;
        pattern.setTransform(new DOMMatrix().scale(GRID_SIZE_CM / tile.width));
        context.setAttr('fillStyle', pattern);
        context.fillRect(0, 0, widthCm, lengthCm);
      }}
    />
  );
}
