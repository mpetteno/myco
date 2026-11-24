import { canvasPalette } from '../appearance/canvasPalette';
import { Layer, Rect, Stage } from 'react-konva';
import { useRef } from 'react';
import type Konva from 'konva';
import { useDarkMode } from '../../shared/hooks/useDarkMode';
import { useElementSize } from '../../shared/hooks/useElementSize';
import type { Bed, BedBounds } from '../beds/bed';
import { BedDrawing } from '../beds/BedDrawing';
import type { BedPosition } from '../beds/bedMovement';
import type { GardenDimensions } from './garden';
import { GardenGrid } from './GardenGrid';
import { usePlanCamera } from '../plan-camera/usePlanCamera';
import type { CameraCommand } from '../plan-camera/planCamera';

type GardenCanvasProps = {
  dimensions: GardenDimensions | null;
  beds: Bed[];
  onMoveBed: (bedId: string, position: BedPosition) => void;
  onResizeBed: (bedId: string, bounds: BedBounds) => void;
  onResizeBlocked?: (message: string | null) => void;
  selectedBedId: string | null;
  resizing?: boolean;
  onSelectBed: (id: string | null) => void;
  onEditBed: (id: string) => void;
  onSetup: () => void;
  readOnly?: boolean; editableBedId?: string;
  cameraCommand?: CameraCommand; panning?: boolean;
};

export function GardenCanvas({ dimensions, beds, onMoveBed, onResizeBed, onResizeBlocked, selectedBedId, onSelectBed, onEditBed, onSetup, editableBedId, resizing = false, readOnly = false, cameraCommand, panning = false }: GardenCanvasProps) {
  const { ref, sizePx } = useElementSize();
  const dark = useDarkMode();
  const colors = canvasPalette(dark);
  const stage = useRef<Konva.Stage>(null);
  const camera = usePlanCamera(ref, stage, dimensions, beds, sizePx, cameraCommand, panning);
  const { view } = camera;
  const canInteract = () => !panning && !camera.blocked.current && Date.now() >= camera.suppressClickUntil.current;
  const select = (id: string | null) => { if (canInteract()) onSelectBed(id); };
  const selected = beds.find((bed) => bed.id === selectedBedId);

  return (
    <div ref={ref} role={dimensions ? 'region' : undefined} tabIndex={dimensions ? 0 : undefined}
        aria-label={dimensions ? `Garden, ${dimensions.widthCm} cm wide and ${dimensions.lengthCm} cm long, with a 5 cm grid and ${beds.length} ${beds.length === 1 ? 'bed' : 'beds'}. ${selected ? `Selected bed: ${selected.name}, ${selected.widthCm} by ${selected.lengthCm} cm. ` : ''}Use arrow keys to select a bed, Enter to edit, and Escape to deselect. Wheel or pinch to zoom; use Pan to move the view.` : 'Garden preview. Set your dimensions to begin.'}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && beds.length) {
            event.preventDefault();
            const current = beds.findIndex((bed) => bed.id === selectedBedId);
            const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
            const index = current < 0 ? direction === 1 ? 0 : beds.length - 1 : (current + direction + beds.length) % beds.length;
            onSelectBed(beds[index].id);
          } else if (event.key === 'Escape') { event.preventDefault(); onSelectBed(null); }
          else if (event.key === 'Enter' && selected && !readOnly && (!editableBedId || editableBedId === selected.id)) { event.preventDefault(); onEditBed(selected.id); }
        }}
        className="h-full min-h-0 w-full overflow-hidden bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-green-600 dark:bg-stone-950">
        {dimensions && view ? (
          <Stage ref={stage} width={sizePx.width} height={sizePx.height}
            className={`touch-none select-none ${panning || !readOnly ? camera.gesturing ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing' : ''}`}
            onClick={(event) => { if (event.target === event.target.getStage()) select(null); }}
            onTap={(event) => { if (event.target === event.target.getStage()) select(null); }}>
            <Layer
              x={view.xPx} y={view.yPx} rotation={view.rotationDeg}
              scaleX={view.pixelsPerCm} scaleY={view.pixelsPerCm}>
              <GardenGrid {...dimensions} pixelsPerCm={view.pixelsPerCm} dark={dark} />
              <Rect width={dimensions.widthCm} height={dimensions.lengthCm}
                stroke={colors.gardenBorder} strokeWidth={1.5} strokeScaleEnabled={false}
                listening={false} />
              <BedDrawing key={camera.gesturing ? 'camera' : 'edit'} beds={beds} garden={dimensions} pixelsPerCm={view.pixelsPerCm} dark={dark}
                readOnly={readOnly || panning || camera.gesturing} editableBedId={editableBedId} resizeEnabled={resizing}
                viewRotationDeg={view.rotationDeg}
                selectedBedId={selectedBedId} onSelectBed={select} onOpenBed={(id) => { if (canInteract()) onEditBed(id); }}
                onMoveBed={(id, position) => { if (!readOnly && !panning && !camera.blocked.current) onMoveBed(id, position); }}
                onResizeBed={(id, bounds) => { if (!readOnly && !panning && !camera.blocked.current) onResizeBed(id, bounds); }} onResizeBlocked={onResizeBlocked} />
            </Layer>
          </Stage>
        ) : !dimensions ? (
          <div className="flex h-full items-center justify-center">
          <div className="max-w-xs space-y-2 p-6 text-center">
            <p className="font-medium">Start with your garden size</p>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              Set a width and length to begin designing your garden.
            </p>
            <button type="button" onClick={onSetup} className="mt-2 min-h-12 cursor-pointer rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-green-600 dark:bg-green-500 dark:text-green-950">Set garden size</button>
          </div>
          </div>
        ) : null}
    </div>
  );
}
