import { useMemo, useState } from 'react';
import { Layer, Rect, Stage } from 'react-konva';
import { useElementSize } from '../../shared/hooks/useElementSize';
import { useDarkMode } from '../../shared/hooks/useDarkMode';
import { canvasPalette } from '../appearance/canvasPalette';
import type { Bed, BedBounds } from '../beds/bed';
import { BedDrawing } from '../beds/BedDrawing';
import { getGardenViewport } from '../garden/gardenViewport';
import { GardenGrid } from '../garden/GardenGrid';
import { previewPlanting } from '../planting/plantingGeometry';
import { PlantingMarks } from '../planting/PlantingMarks';
import { getAreaMeasurements } from '../planting/areaMeasurements';
import { AreaRowDistanceGuides } from '../planting/AreaRowDistanceGuides';
import { AreaCanvasInfo } from '../planting/AreaCanvasInfo';
import { MulchMarks } from '../mulch/MulchMarks';
import { areaLabel, areaMulchPlan, rowPlan, resizePlanAreas } from './areaPlan';
import type { BedAreaPlan } from './areaPlan';
import { getAreaViewport } from './areaViewport';
import type { AreaFocus } from './areaViewport';
import { AreaSurfaceMarks } from './AreaSurfaceMarks';

type Props = { bed: Bed; plan: BedAreaPlan; selectedId: string | null; onSelect: (id: string | null) => void;
  onBounds: (id: string, bounds: BedBounds) => void; onOpenArea?: (focus: AreaFocus) => void;
  focus?: AreaFocus; focusZoom?: number; readOnly?: boolean };
const rectangles = (plan: BedAreaPlan): Bed[] => plan.areas.map((area) => ({ ...area, name: areaLabel(area) }));
export function AreaPlanCanvas({ bed, plan, selectedId, onSelect, onBounds, onOpenArea, focus, focusZoom = 0.8, readOnly = false }: Props) {
  const { ref, sizePx } = useElementSize(), dark = useDarkMode(), colors = canvasPalette(dark);
  const focalArea = plan.areas.find((area) => area.id === focus?.id);
  const view = focalArea ? getAreaViewport(focalArea, sizePx, focusZoom) : getGardenViewport(bed, sizePx);
  const [transient, setTransient] = useState<Bed | null>(null);
  const beds = useMemo(() => rectangles(plan), [plan]);
  const visible = useMemo(() => focus ? beds.filter((area) => area.id === focus.id) : beds, [beds, focus?.id]);
  const shown = transient?.id === selectedId ? { ...plan, areas: resizePlanAreas(plan, transient.id, transient, bed) ?? plan.areas } : plan;
  const rows = rowPlan(shown), mulch = areaMulchPlan(shown);
  const preview = rows.areas.length ? previewPlanting(rows, bed) : { points: [], rowGuides: [], counts: [], error: null };
  const selected = shown.areas.find((area) => area.id === selectedId), index = rows.areas.findIndex((area) => area.id === selectedId);
  const row = rows.areas[index], measurements = row ? getAreaMeasurements(rows, row, bed) : [];
  const select = focus ? () => {} : onSelect;
  function resizePreview(next: Bed) {
    const areas = resizePlanAreas(plan, next.id, next, bed);
    return areas && rectangles({ ...plan, areas });
  }
  return <section className="flex h-full min-h-0 w-full flex-col overflow-hidden">
    {row ? <AreaCanvasInfo area={row} index={index} measurements={measurements} label={selected ? areaLabel(selected) : undefined} /> : <div className="flex min-h-14 shrink-0 flex-col justify-center border-b border-stone-200 px-4 py-2 text-sm dark:border-stone-800">
      <p className="truncate font-medium">{selected ? areaLabel(selected) : 'Select an area'}</p>
      {selected && <p className="text-xs text-stone-600 dark:text-stone-400">{selected.widthCm} × {selected.lengthCm} cm · {selected.kind === 'broadcast' ? 'Broadcast sowing' : 'Unplanted'}{selected.purpose === 'green_manure' ? ' · Green manure' : ''}</p>}
    </div>}
    <div ref={ref} role="img" aria-label={`Area preview for ${bed.name}, ${bed.widthCm} by ${bed.lengthCm} cm, with a 5 cm grid. ${plan.areas.length} areas, ${preview.points.length} individual plants.`} className="min-h-0 flex-1 overflow-hidden bg-stone-100 dark:bg-stone-950">
      {view && <Stage width={sizePx.width} height={sizePx.height} className="touch-none select-none" onClick={(event) => { if (event.target === event.target.getStage()) select(null); }} onTap={(event) => { if (event.target === event.target.getStage()) select(null); }}>
        <Layer x={view.xPx} y={view.yPx} rotation={view.rotationDeg} scaleX={view.pixelsPerCm} scaleY={view.pixelsPerCm}>
          <Rect width={bed.widthCm} height={bed.lengthCm} fill={colors.soil} stroke={colors.bedBorder} strokeWidth={1 / view.pixelsPerCm} listening={false} />
          <BedDrawing beds={visible} garden={bed} pixelsPerCm={view.pixelsPerCm} dark={dark} viewRotationDeg={view.rotationDeg} readOnly={readOnly} obstacles={beds} resizeObstacles={[]}
            showLabels={false} showDistanceGuides={!row} canResize={(next) => !!resizePreview(next)} resizePreview={resizePreview} selectedBedId={selectedId} onSelectBed={select} onPreviewBed={setTransient}
            onOpenBed={focus ? undefined : (id) => { select(id); onOpenArea?.({ kind: 'planting', id }); }}
            surfaceOverlay={<><AreaSurfaceMarks plan={shown} pixelsPerCm={view.pixelsPerCm} dark={dark} /><MulchMarks plan={mulch} points={preview.points} bed={bed} pixelsPerCm={view.pixelsPerCm} bounds={focalArea} />
              <GardenGrid widthCm={bed.widthCm} lengthCm={bed.lengthCm} pixelsPerCm={view.pixelsPerCm} dark={dark} surface="bed" /></>}
            contentOverlay={<><PlantingMarks dark={dark} points={preview.points} rowGuides={preview.rowGuides} pixelsPerCm={view.pixelsPerCm} showRows />
              {row && <AreaRowDistanceGuides measurements={measurements} bed={bed} pixelsPerCm={view.pixelsPerCm} dark={dark} viewRotationDeg={view.rotationDeg} />}</>}
            onMoveBed={(id, position) => { const area = beds.find((item) => item.id === id); if (area) onBounds(id, { ...area, ...position }); }} onResizeBed={onBounds} />
        </Layer>
      </Stage>}
    </div>
  </section>;
}
