import type { BedBounds } from '../beds/bed';

export type CanvasSize = { width: number; height: number };
export type CanvasPoint = { x: number; y: number };
export type PlanCamera = { xPx: number; yPx: number; pixelsPerCm: number; rotationDeg: 0 | 90 };
export type CameraCommand = { action: 'fit' | 'focus' | 'zoom-in' | 'zoom-out'; targetId?: string; revision: number };

export function zoomCamera(view: PlanCamera, anchor: CanvasPoint, factor: number, fitScale: number): PlanCamera {
  const pixelsPerCm = Math.max(fitScale * 0.5, Math.min(fitScale * 32, view.pixelsPerCm * factor));
  const ratio = pixelsPerCm / view.pixelsPerCm;
  return { ...view, pixelsPerCm, xPx: anchor.x - (anchor.x - view.xPx) * ratio, yPx: anchor.y - (anchor.y - view.yPx) * ratio };
}

export function fitBoundsCamera(bounds: BedBounds, size: CanvasSize, view: PlanCamera): PlanCamera {
  const turned = view.rotationDeg === 90;
  const scale = Math.min(Math.max(1, size.width - 64) / (turned ? bounds.lengthCm : bounds.widthCm),
    Math.max(1, size.height - 64) / (turned ? bounds.widthCm : bounds.lengthCm));
  const center = { x: bounds.xCm + bounds.widthCm / 2, y: bounds.yCm + bounds.lengthCm / 2 };
  return { ...view, pixelsPerCm: scale,
    xPx: size.width / 2 - (turned ? -center.y : center.x) * scale,
    yPx: size.height / 2 - (turned ? center.x : center.y) * scale };
}

export function panCamera(view: PlanCamera, delta: CanvasPoint): PlanCamera {
  return { ...view, xPx: view.xPx + delta.x, yPx: view.yPx + delta.y };
}
