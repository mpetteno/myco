import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { GardenDimensions } from '../garden/garden';
import type { Bed, BedBounds } from './bed';
import type { BedPosition } from './bedMovement';
import { BedResizeHandles } from './BedResizeHandles';
import { BedShape } from './BedShape';
import { BedAlignmentGuides } from './BedAlignmentGuides';
import { BedDistanceGuides } from './BedDistanceGuides';
import { BedLabel } from './BedLabel';

type BedDrawingProps = {
  beds: Bed[];
  garden: GardenDimensions;
  pixelsPerCm: number;
  dark: boolean;
  viewRotationDeg: 0 | 90;
  selectedBedId: string | null;
  onSelectBed: (id: string | null) => void;
  onOpenBed?: (id: string) => void;
  onMoveBed: (id: string, position: BedPosition) => void;
  onResizeBed: (id: string, bounds: BedBounds) => void;
  onPreviewBed?: (bed: Bed | null) => void;
  surfaceOverlay?: ReactNode;
  contentOverlay?: ReactNode;
  showLabels?: boolean;
  showDistanceGuides?: boolean;
  resizeEnabled?: boolean;
  canResize?: (bed: Bed) => boolean;
  readOnly?: boolean; editableBedId?: string;
  obstacles?: Bed[];
  resizeObstacles?: Bed[];
  resizePreview?: (bed: Bed) => Bed[] | null;
  onResizeBlocked?: (message: string | null) => void;
};

export function BedDrawing({ beds, garden, pixelsPerCm, dark, viewRotationDeg, selectedBedId, onSelectBed, onOpenBed, onMoveBed, onResizeBed, onPreviewBed, surfaceOverlay, contentOverlay, showLabels = true, showDistanceGuides = true, canResize, resizeEnabled = true, readOnly = false, editableBedId, obstacles = beds, resizeObstacles = obstacles, resizePreview, onResizeBlocked }: BedDrawingProps) {
  const [preview, setPreview] = useState<Bed | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [movePreview, setMovePreview] = useState<Bed | null>(null);

  useEffect(() => { setPreview(null); setMovePreview(null); }, [beds]);
  useEffect(() => {
    setPreview((current) => current?.id === selectedBedId ? current : null);
    setMovePreview((current) => current?.id === selectedBedId ? current : null);
  }, [selectedBedId]);

  const resized = preview && resizePreview?.(preview);
  const shownBeds = beds.map((bed) => resized?.find((area) => area.id === bed.id)
    ?? (preview?.id === bed.id && selectedBedId === bed.id ? preview : bed));
  const selectedBed = shownBeds.find((bed) => bed.id === selectedBedId);
  // Keep movement previews separate so guide updates do not reset the dragged node.
  const guideBed = movePreview?.id === selectedBedId ? movePreview : selectedBed;

  return (
    <>
      {guideBed && !readOnly && <BedAlignmentGuides bed={guideBed} beds={beds} garden={garden}
        pixelsPerCm={pixelsPerCm} dark={dark} />}
      {shownBeds.map((bed) => (
        <BedShape key={bed.id} bed={bed} garden={garden} beds={obstacles}
          pixelsPerCm={pixelsPerCm}
          dark={dark} selected={bed.id === selectedBedId}
          readOnly={readOnly || (!!editableBedId && editableBedId !== bed.id)}
          onOpen={readOnly ? undefined : () => onOpenBed?.(bed.id)}
          onSelect={() => onSelectBed(bed.id)} onMovingChange={(moving) => {
            setMovingId(moving ? bed.id : null);
            if (!moving) { setMovePreview(null); onPreviewBed?.(null); }
          }} onMovePreview={(next) => { setMovePreview(next); onPreviewBed?.(next); }}
          onMove={onMoveBed} />
      ))}
      {surfaceOverlay}
      {guideBed && showDistanceGuides && <BedDistanceGuides bed={guideBed} beds={beds} garden={garden}
        pixelsPerCm={pixelsPerCm} dark={dark} viewRotationDeg={viewRotationDeg} />}
      {showLabels && shownBeds.map((bed) => (
        <BedLabel key={bed.id} bed={movePreview?.id === bed.id ? movePreview : bed}
          pixelsPerCm={pixelsPerCm} dark={dark} />
      ))}
      {contentOverlay}
      {selectedBed && resizeEnabled && !movingId && !readOnly && (!editableBedId || editableBedId === selectedBed.id) && (
        <BedResizeHandles key={selectedBed.id} bed={selectedBed} beds={resizeObstacles} garden={garden}
          canResize={canResize} dark={dark} onBlocked={onResizeBlocked}
          pixelsPerCm={pixelsPerCm} onPreview={(next) => { setPreview(next); onPreviewBed?.(next); }}
          onCommit={(resized) => { onResizeBed(resized.id, resized); setPreview(null); onPreviewBed?.(null); }} />
      )}
    </>
  );
}
