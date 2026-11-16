import { canvasPalette } from '../appearance/canvasPalette';
import { useMemo } from 'react';
import { Shape } from 'react-konva';
import { GRID_SIZE_CM } from './garden';
import type { GardenDimensions } from './garden';

type GardenGridProps = GardenDimensions & {
  pixelsPerCm: number;
  dark: boolean;
  surface?: 'garden' | 'bed';
};

export function GardenGrid({ widthCm, lengthCm, pixelsPerCm, dark, surface = 'garden' }: GardenGridProps) {
  const tile = useMemo(() => {
    const colors = canvasPalette(dark);
    // A repeating tile keeps the grid cheap even for large gardens.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d')!;
    if (surface === 'garden') {
      context.fillStyle = colors.garden;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.strokeStyle = surface === 'bed' ? colors.soilGrid : colors.gardenGrid;
    context.lineWidth = Math.min(16, 0.6 * canvas.width / (GRID_SIZE_CM * pixelsPerCm));
    context.strokeRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }, [pixelsPerCm, dark, surface]);

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
