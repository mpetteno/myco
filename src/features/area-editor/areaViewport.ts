import type { BedBounds } from '../beds/bed';
import { getGardenViewport } from '../garden/gardenViewport';

export type AreaFocus = { kind: 'planting' | 'mulch'; id: string };
export function getAreaViewport(area: BedBounds, sizePx: { width: number; height: number }, zoom = 1) {
  const view = getGardenViewport(area, sizePx);
  if (!view) return null;
  const pixelsPerCm = view.pixelsPerCm * zoom;
  return { ...view, pixelsPerCm,
    xPx: sizePx.width / 2 + (view.xPx - sizePx.width / 2) * zoom - (view.rotationDeg === 90 ? -area.yCm : area.xCm) * pixelsPerCm,
    yPx: sizePx.height / 2 + (view.yPx - sizePx.height / 2) * zoom - (view.rotationDeg === 90 ? area.xCm : area.yCm) * pixelsPerCm };
}
