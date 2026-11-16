import { canvasPalette } from '../appearance/canvasPalette';
import { Layer, Rect, Stage } from 'react-konva';
import { useDarkMode } from '../../shared/hooks/useDarkMode';
import { useElementSize } from '../../shared/hooks/useElementSize';
import type { Bed, BedBounds } from '../beds/bed';
import { BedDrawing } from '../beds/BedDrawing';
import type { BedPosition } from '../beds/bedMovement';
import type { GardenDimensions } from './garden';
import { GardenGrid } from './GardenGrid';
import { getGardenViewport } from './gardenViewport';

type GardenCanvasProps = {
  dimensions: GardenDimensions | null;
  beds: Bed[];
  onMoveBed: (bedId: string, position: BedPosition) => void;
  onResizeBed: (bedId: string, bounds: BedBounds) => void;
  selectedBedId: string | null;
  onSelectBed: (id: string | null) => void;
  onEditBed: (id: string) => void;
  onSetup: () => void;
  readOnly?: boolean; editableBedId?: string;
};

export function GardenCanvas({ dimensions, beds, onMoveBed, onResizeBed, selectedBedId, onSelectBed, onEditBed, onSetup, editableBedId, readOnly = false }: GardenCanvasProps) {
  const { ref, sizePx } = useElementSize();
  const dark = useDarkMode();
  const colors = canvasPalette(dark);
  const view = dimensions ? getGardenViewport(dimensions, sizePx) : null;

  return (
    <div ref={ref} role={dimensions ? 'region' : undefined} tabIndex={dimensions ? 0 : undefined}
        aria-label={dimensions ? `Garden, ${dimensions.widthCm} cm wide and ${dimensions.lengthCm} cm long, with a 5 cm grid and ${beds.length} ${beds.length === 1 ? 'bed' : 'beds'}. Bed names and dimensions are listed in the Beds section.` : 'Garden preview. Set your dimensions to begin.'}
        className="h-full min-h-0 w-full overflow-hidden bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-green-600 dark:bg-stone-950">
        {dimensions && view ? (
          <Stage width={sizePx.width} height={sizePx.height}
            className={`touch-none select-none ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'}`}
            onClick={(event) => { if (event.target === event.target.getStage()) onSelectBed(null); }}
            onTap={(event) => { if (event.target === event.target.getStage()) onSelectBed(null); }}>
            <Layer
              x={view.xPx} y={view.yPx} rotation={view.rotationDeg}
              scaleX={view.pixelsPerCm} scaleY={view.pixelsPerCm}>
              <GardenGrid {...dimensions} pixelsPerCm={view.pixelsPerCm} dark={dark} />
              <Rect width={dimensions.widthCm} height={dimensions.lengthCm}
                stroke={colors.gardenBorder} strokeWidth={1.5} strokeScaleEnabled={false}
                listening={false} />
              <BedDrawing beds={beds} garden={dimensions} pixelsPerCm={view.pixelsPerCm} dark={dark}
                readOnly={readOnly} editableBedId={editableBedId}
                viewRotationDeg={view.rotationDeg}
                selectedBedId={selectedBedId} onSelectBed={onSelectBed} onOpenBed={onEditBed}
                onMoveBed={onMoveBed} onResizeBed={onResizeBed} />
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
