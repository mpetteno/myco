import { canvasPalette } from '../appearance/canvasPalette';
import { Shape } from 'react-konva';
import type { PlantPoint } from './plantingPlan';
import type { PlantRowGuide } from './plantingGeometry';

export const areaColor = (index: number, dark = false) => {
  const colors = canvasPalette(dark).plants;
  return colors[index % colors.length];
};

export function PlantingMarks({ points, pixelsPerCm, showRows = false, rowGuides, dark }: { dark: boolean; points: PlantPoint[]; pixelsPerCm: number; showRows?: boolean; rowGuides?: PlantRowGuide[] }) {
  return <Shape listening={false} sceneFunc={(context) => {
    const radiusCm = 2.5 / pixelsPerCm;
    if (showRows) {
      const rows = new Map<string, { first: PlantPoint; last: PlantPoint }>();
      for (const point of points) {
        const key = `${point.areaIndex}:${point.rowIndex}`;
        const row = rows.get(key);
        if (row) row.last = point; else rows.set(key, { first: point, last: point });
      }
      context.lineWidth = 1 / pixelsPerCm; context.setLineDash([3 / pixelsPerCm, 3 / pixelsPerCm]);
      const guides: PlantRowGuide[] = rowGuides ?? [...rows.values()].map(({ first, last }) => ({ areaIndex: first.areaIndex, x1Cm: first.xCm, y1Cm: first.yCm, x2Cm: last.xCm, y2Cm: last.yCm }));
      for (const guide of guides) {
        context.beginPath(); context.moveTo(guide.x1Cm, guide.y1Cm); context.lineTo(guide.x2Cm, guide.y2Cm);
        context.strokeStyle = guide.warning ? canvasPalette(dark).warning : areaColor(guide.areaIndex, dark); context.stroke();
      }
      context.setLineDash([]);
    }
    for (let index = 0; index < 12; index++) {
      context.beginPath();
      for (const point of points) if (point.areaIndex === index) {
        context.moveTo(point.xCm + radiusCm, point.yCm);
        context.arc(point.xCm, point.yCm, radiusCm, 0, Math.PI * 2);
      }
      context.fillStyle = areaColor(index, dark); context.fill();
      context.strokeStyle = canvasPalette(dark).label; context.lineWidth = 1 / pixelsPerCm; context.stroke();
    }
  }} />;
}
