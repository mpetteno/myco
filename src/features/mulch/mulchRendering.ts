import type { GardenDimensions } from '../garden/garden';
import type { PlantPoint } from '../planting/plantingPlan';
import type { BedMulchPlan, MulchArea } from './mulchPlan';
import type { BedBounds } from '../beds/bed';
import { PLANT_CLEARANCE_RADIUS_CM } from './mulchPlan';

export type MulchLayerPreview = { areaId: string; layerId: string } | null;
const colors = ['#d6b66c', '#9f8158', '#c29267', '#758b59', '#b7a079', '#b68e56'];
export function mulchColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}
export function visibleMulchLayer(area: MulchArea, preview: MulchLayerPreview) {
  return (preview?.areaId === area.id ? area.layers.find((layer) => layer.id === preview.layerId) : undefined) ?? area.layers.at(-1);
}

export function paintMulch(context: CanvasRenderingContext2D, plan: BedMulchPlan, points: PlantPoint[], preview: MulchLayerPreview) {
  for (const area of plan.areas) {
    const layer = visibleMulchLayer(area, preview);
    if (!layer) continue;
    context.fillStyle = mulchColor(layer.material.id);
    context.fillRect(area.xCm, area.yCm, area.widthCm, area.lengthCm);
  }
  // Erase on an isolated surface: overlapping clearances form a union and
  // reveal the soil underneath without erasing plants, the grid or other beds.
  context.globalCompositeOperation = 'destination-out';
  context.beginPath();
  for (const point of points) {
    context.moveTo(point.xCm + PLANT_CLEARANCE_RADIUS_CM, point.yCm);
    context.arc(point.xCm, point.yCm, PLANT_CLEARANCE_RADIUS_CM, 0, Math.PI * 2);
  }
  context.fill();
  context.globalCompositeOperation = 'source-over';
}

export function createMulchSurface(plan: BedMulchPlan, points: PlantPoint[], bed: GardenDimensions, pixelsPerCm: number, preview: MulchLayerPreview, bounds: BedBounds = { ...bed,xCm:0,yCm:0 }) {
  const surface = document.createElement('canvas');
  const scalePxPerCm = Math.min(pixelsPerCm * (window.devicePixelRatio || 1), 4096 / Math.max(bounds.widthCm, bounds.lengthCm));
  surface.width = Math.max(1, Math.ceil(bounds.widthCm * scalePxPerCm));
  surface.height = Math.max(1, Math.ceil(bounds.lengthCm * scalePxPerCm));
  const context = surface.getContext('2d');
  if (context) {
    context.scale(scalePxPerCm, scalePxPerCm);
    context.translate(-bounds.xCm,-bounds.yCm);
    paintMulch(context, plan, points, preview);
  }
  return surface;
}
