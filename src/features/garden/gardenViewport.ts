import type { GardenDimensions } from './garden';

type ViewportSizePx = { width: number; height: number };

export function getGardenViewport(garden: GardenDimensions, sizePx: ViewportSizePx) {
  const paddingPx = 18; // Keep edge and corner handles reachable.
  const availableWidthPx = sizePx.width - paddingPx * 2;
  const availableHeightPx = sizePx.height - paddingPx * 2;
  if (availableWidthPx <= 0 || availableHeightPx <= 0) return null;

  const normalScale = Math.min(availableWidthPx / garden.widthCm, availableHeightPx / garden.lengthCm);
  const turnedScale = Math.min(availableWidthPx / garden.lengthCm, availableHeightPx / garden.widthCm);
  const turned = turnedScale > normalScale;
  const pixelsPerCm = turned ? turnedScale : normalScale;
  const widthPx = (turned ? garden.lengthCm : garden.widthCm) * pixelsPerCm;
  const heightPx = (turned ? garden.widthCm : garden.lengthCm) * pixelsPerCm;
  const rotationDeg: 0 | 90 = turned ? 90 : 0;

  // A clockwise quarter turn places the original origin at the upper-right.
  return {
    pixelsPerCm,
    rotationDeg,
    xPx: (sizePx.width - widthPx) / 2 + (turned ? widthPx : 0),
    yPx: (sizePx.height - heightPx) / 2,
  };
}
