import { canvasPalette } from '../appearance/canvasPalette';
import { useMemo, useState } from 'react';
import { Layer, Rect, Stage } from 'react-konva';
import { useElementSize } from '../../shared/hooks/useElementSize';
import { useDarkMode } from '../../shared/hooks/useDarkMode';
import type { Bed, BedBounds } from '../beds/bed';
import { BedDrawing } from '../beds/BedDrawing';
import { getGardenViewport } from '../garden/gardenViewport';
import { GardenGrid } from '../garden/GardenGrid';
import { areaBeds } from './plantingAreas';
import type { BedPlantingPlan } from './plantingPlan';
import { previewPlanting } from './plantingGeometry';
import { PlantingMarks } from './PlantingMarks';
import { resizePlantingAreas } from './areaResize';
import { resizeAreas } from '../area-editor/resizeAreas';
import { getAreaMeasurements } from './areaMeasurements';
import { AreaRowDistanceGuides } from './AreaRowDistanceGuides';
import { AreaCanvasInfo } from './AreaCanvasInfo';
import type { BedMulchPlan } from '../mulch/mulchPlan';
import type { MulchLayerPreview } from '../mulch/mulchRendering';
import { MulchMarks } from '../mulch/MulchMarks';
import { MulchCanvasInfo } from '../mulch/MulchCanvasInfo';
import { mulchAreaBeds } from '../mulch/mulchAreas';
import { getAreaViewport } from '../area-editor/areaViewport';
import type { AreaFocus } from '../area-editor/areaViewport';

type BedPlanCanvasProps = { bed: Bed; plan: BedPlantingPlan; selectedId: string | null;
  onSelect: (id: string | null) => void; onBounds: (id: string, bounds: BedBounds) => void; onOpenArea?: (focus: AreaFocus) => void;
  editingMulch: boolean; focus?: AreaFocus; focusZoom?: number; readOnly?: boolean;
  mulch: { plan: BedMulchPlan; selectedId: string | null; preview: MulchLayerPreview;
    onSelect: (id: string | null) => void; onBounds: (id: string, bounds: BedBounds) => void } };

export function BedPlanCanvas({ bed, plan, selectedId, onSelect, onBounds, onOpenArea, mulch, editingMulch, focus, focusZoom = 1, readOnly = false }: BedPlanCanvasProps) {
  const { ref, sizePx } = useElementSize();
  const dark = useDarkMode();
  const colors = canvasPalette(dark);
  const focalArea = focus?.kind === 'mulch' ? mulch.plan.areas.find((area) => area.id === focus.id) : plan.areas.find((area) => area.id === focus?.id);
  const view = focalArea ? getAreaViewport(focalArea, sizePx,focusZoom) : getGardenViewport(bed, sizePx);
  const [transient, setTransient] = useState<Bed | null>(null);
  const activeId = editingMulch ? mulch.selectedId : selectedId;
  const select = focus ? () => {} : editingMulch ? mulch.onSelect : onSelect, bounds = editingMulch ? mulch.onBounds : onBounds;
  const beds = useMemo(() => (editingMulch ? mulchAreaBeds(mulch.plan.areas) : areaBeds(plan.areas)), [plan.areas, mulch.plan.areas, editingMulch]);
  // A new array on each transient drag render resets BedDrawing's gesture preview.
  const visibleBeds = useMemo(() => focus ? beds.filter((area) => area.id === focus.id) : beds,[beds,focus?.id]);
  const shownPlan = !editingMulch && transient?.id === selectedId
    ? { ...plan, areas: resizePlantingAreas(plan, transient.id, transient, bed) ?? plan.areas } : plan;
  const shownMulch = editingMulch && transient?.id === activeId
    ? { ...mulch.plan, areas: resizeAreas(mulch.plan.areas, transient.id, transient, bed) ?? mulch.plan.areas } : mulch.plan;
  const surfaceArea = focus?.kind==='mulch' ? shownMulch.areas.find((area)=>area.id===focus.id) : shownPlan.areas.find((area)=>area.id===focus?.id);
  const preview = previewPlanting({ ...shownPlan, advice: [] }, bed);
  const selectedIndex = shownPlan.areas.findIndex((area) => area.id === selectedId);
  const selected = shownPlan.areas[selectedIndex];
  const measurements = selected ? getAreaMeasurements(shownPlan, selected, bed) : [];
  function resizePreview(next: Bed) {
    if (editingMulch) {
      const areas = resizeAreas(mulch.plan.areas, next.id, next, bed);
      return areas && mulchAreaBeds(areas);
    }
    const areas = resizePlantingAreas(plan, next.id, next, bed);
    return areas && areaBeds(areas);
  }
  return <section className="flex h-full min-h-0 w-full flex-col overflow-hidden">
    {editingMulch ? <MulchCanvasInfo area={shownMulch.areas.find((area) => area.id === activeId)} preview={mulch.preview} /> : <AreaCanvasInfo area={selected} index={selectedIndex} measurements={measurements} />}
    <div ref={ref} role="img" aria-label={`Planting preview for ${bed.name}, ${bed.widthCm} by ${bed.lengthCm} cm, with a 5 cm grid. ${preview.points.length} plants. Drag areas to move, and their handles to resize.`}
      className="min-h-0 flex-1 overflow-hidden bg-stone-100 dark:bg-stone-950">
    {view && <Stage width={sizePx.width} height={sizePx.height} className="touch-none select-none"
      onClick={(event) => { if (event.target === event.target.getStage()) select(null); }}
      onTap={(event) => { if (event.target === event.target.getStage()) select(null); }}>
      <Layer x={view.xPx} y={view.yPx} rotation={view.rotationDeg} scaleX={view.pixelsPerCm} scaleY={view.pixelsPerCm}>
        <Rect width={bed.widthCm} height={bed.lengthCm} fill={colors.soil} stroke={colors.bedBorder} strokeWidth={1 / view.pixelsPerCm} listening={false} />
        <BedDrawing beds={visibleBeds} garden={bed} pixelsPerCm={view.pixelsPerCm} dark={dark} viewRotationDeg={view.rotationDeg}
          readOnly={readOnly} obstacles={beds} resizeObstacles={[]}
          showLabels={false} showDistanceGuides={editingMulch} canResize={(next) => !!resizePreview(next)} resizePreview={resizePreview}
          selectedBedId={activeId} onSelectBed={select} onPreviewBed={setTransient}
          onOpenBed={focus ? undefined : (id) => { select(id); onOpenArea?.({ kind: editingMulch ? 'mulch' : 'planting', id }); }}
          surfaceOverlay={<><MulchMarks plan={shownMulch} points={preview.points} bed={bed} pixelsPerCm={view.pixelsPerCm} preview={editingMulch ? mulch.preview : null} bounds={surfaceArea} />
            <GardenGrid widthCm={bed.widthCm} lengthCm={bed.lengthCm} pixelsPerCm={view.pixelsPerCm} dark={dark} surface="bed" /></>}
          contentOverlay={<><PlantingMarks dark={dark} points={preview.points} rowGuides={preview.rowGuides} pixelsPerCm={view.pixelsPerCm} showRows />
            {!editingMulch && <AreaRowDistanceGuides measurements={measurements} bed={bed} pixelsPerCm={view.pixelsPerCm} dark={dark} viewRotationDeg={view.rotationDeg} />}</>}
          onMoveBed={(id, position) => { const area = beds.find((item) => item.id === id); if (area) bounds(id, { ...area, ...position }); }}
          onResizeBed={bounds} />
      </Layer>
    </Stage>}
    </div>
  </section>;
}
