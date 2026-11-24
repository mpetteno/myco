import { useEffect, useMemo, useRef, useState } from 'react';
import type Konva from 'konva';
import { Layer, Rect, Stage } from 'react-konva';
import { useElementSize } from '../../shared/hooks/useElementSize';
import { useDarkMode } from '../../shared/hooks/useDarkMode';
import { canvasPalette } from '../appearance/canvasPalette';
import type { Bed, BedBounds } from '../beds/bed';
import { BedDrawing } from '../beds/BedDrawing';
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
import { usePlanCamera } from '../plan-camera/usePlanCamera';
import type { CameraCommand } from '../plan-camera/planCamera';

type Props = { bed: Bed; plan: BedAreaPlan; selectedId: string | null; onSelect: (id: string | null) => void;
  onBounds: (id: string, bounds: BedBounds) => void; onOpenArea?: (focus: AreaFocus) => void;
  focus?: AreaFocus; focusZoom?: number; readOnly?: boolean; resizing?: boolean;
  cameraCommand?: CameraCommand; panning?: boolean };
const rectangles = (plan: BedAreaPlan): Bed[] => plan.areas.map((area) => ({ ...area, name: areaLabel(area) }));
export function AreaPlanCanvas({ bed, plan, selectedId, onSelect, onBounds, onOpenArea, focus, focusZoom = 0.8, readOnly = false, resizing = false, cameraCommand, panning = false }: Props) {
  const { ref, sizePx } = useElementSize(), dark = useDarkMode(), colors = canvasPalette(dark);
  const stage = useRef<Konva.Stage>(null);
  const camera = usePlanCamera(ref, stage, bed, plan.areas, sizePx, cameraCommand, panning);
  const focalArea = plan.areas.find((area) => area.id === focus?.id);
  const view = focalArea ? getAreaViewport(focalArea, sizePx, focusZoom) : camera.view;
  const [transient, setTransient] = useState<Bed | null>(null);
  useEffect(() => { if (camera.gesturing) setTransient(null); }, [camera.gesturing]);
  const beds = useMemo(() => rectangles(plan), [plan]);
  const visible = useMemo(() => focus ? beds.filter((area) => area.id === focus.id) : beds, [beds, focus?.id]);
  const shown = transient?.id === selectedId ? { ...plan, areas: resizePlanAreas(plan, transient.id, transient, bed) ?? plan.areas } : plan;
  const rows = rowPlan(shown), mulch = areaMulchPlan(shown);
  const preview = rows.areas.length ? previewPlanting(rows, bed) : { points: [], rowGuides: [], counts: [], error: null };
  const selected = shown.areas.find((area) => area.id === selectedId), index = rows.areas.findIndex((area) => area.id === selectedId);
  const row = rows.areas[index], measurements = row ? getAreaMeasurements(rows, row, bed) : [];
  const select = (id: string | null) => { if (!focus && !panning && !camera.blocked.current && Date.now() >= camera.suppressClickUntil.current) onSelect(id); };
  const commit = (id: string, bounds: BedBounds) => { if (!camera.blocked.current && !panning && !readOnly) onBounds(id, bounds); };
  function resizePreview(next: Bed) {
    const areas = resizePlanAreas(plan, next.id, next, bed);
    return areas && rectangles({ ...plan, areas });
  }
  return <section className="flex h-full min-h-0 w-full flex-col overflow-hidden">
    {row ? <AreaCanvasInfo area={row} index={index} measurements={measurements} label={selected ? areaLabel(selected) : undefined} /> : <div className="flex h-12 shrink-0 flex-col justify-center border-b border-stone-200 bg-white px-4 text-sm dark:border-stone-800 dark:bg-stone-900">
      <p className="truncate font-medium">{selected ? areaLabel(selected) : 'Select an area'}</p>
      <p className="h-4 truncate text-xs text-stone-600 dark:text-stone-400">{selected ? `${selected.widthCm} × ${selected.lengthCm} cm · ${selected.kind === 'broadcast' ? 'Broadcast sowing' : 'Unplanted'}${selected.purpose === 'green_manure' ? ' · Green manure' : ''}` : 'Wheel or pinch to zoom · Use Pan to move the view'}</p>
    </div>}
    <div ref={ref} role="img" aria-label={`Area preview for ${bed.name}, ${bed.widthCm} by ${bed.lengthCm} cm, with a 5 cm grid. ${plan.areas.length} areas, ${preview.points.length} individual plants.`} className={`min-h-0 flex-1 touch-none overflow-hidden bg-stone-100 dark:bg-stone-950 ${panning ? camera.gesturing ? 'cursor-grabbing' : 'cursor-grab' : ''}`}>
      {view && <Stage ref={stage} width={sizePx.width} height={sizePx.height} className="touch-none select-none" onClick={(event) => { if (event.target === event.target.getStage()) select(null); }} onTap={(event) => { if (event.target === event.target.getStage()) select(null); }}>
        <Layer x={view.xPx} y={view.yPx} rotation={view.rotationDeg} scaleX={view.pixelsPerCm} scaleY={view.pixelsPerCm}>
          <Rect width={bed.widthCm} height={bed.lengthCm} fill={colors.soil} stroke={colors.bedBorder} strokeWidth={1 / view.pixelsPerCm} listening={false} />
          <BedDrawing key={camera.gesturing ? 'camera' : 'edit'} beds={visible} garden={bed} pixelsPerCm={view.pixelsPerCm} dark={dark} viewRotationDeg={view.rotationDeg} readOnly={readOnly || panning || camera.gesturing} resizeEnabled={resizing} obstacles={beds} resizeObstacles={[]}
            showLabels={false} showDistanceGuides={!row} canResize={(next) => !!resizePreview(next)} resizePreview={resizePreview} selectedBedId={selectedId} onSelectBed={select} onPreviewBed={setTransient}
            onOpenBed={focus ? undefined : (id) => { select(id); onOpenArea?.({ kind: 'planting', id }); }}
            surfaceOverlay={<><AreaSurfaceMarks plan={shown} pixelsPerCm={view.pixelsPerCm} dark={dark} /><MulchMarks plan={mulch} points={preview.points} bed={bed} pixelsPerCm={view.pixelsPerCm} bounds={focalArea} />
              <GardenGrid widthCm={bed.widthCm} lengthCm={bed.lengthCm} pixelsPerCm={view.pixelsPerCm} dark={dark} surface="bed" /></>}
            contentOverlay={<><PlantingMarks dark={dark} points={preview.points} rowGuides={preview.rowGuides} pixelsPerCm={view.pixelsPerCm} showRows />
              {row && <AreaRowDistanceGuides measurements={measurements} bed={bed} pixelsPerCm={view.pixelsPerCm} dark={dark} viewRotationDeg={view.rotationDeg} />}</>}
            onMoveBed={(id, position) => { const area = beds.find((item) => item.id === id); if (area) commit(id, { ...area, ...position }); }} onResizeBed={commit} />
        </Layer>
      </Stage>}
    </div>
  </section>;
}
