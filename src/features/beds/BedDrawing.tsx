import { useEffect, useState } from 'react';
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
  onMoveBed: (id: string, position: BedPosition) => void;
  onResizeBed: (id: string, bounds: BedBounds) => void;
};

export function BedDrawing({ beds, garden, pixelsPerCm, dark, viewRotationDeg, selectedBedId, onSelectBed, onMoveBed, onResizeBed }: BedDrawingProps) {
  const [preview, setPreview] = useState<Bed | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [movePreview, setMovePreview] = useState<Bed | null>(null);

  useEffect(() => { setPreview(null); setMovePreview(null); }, [beds]);
  useEffect(() => {
    setPreview((current) => current?.id === selectedBedId ? current : null);
    setMovePreview((current) => current?.id === selectedBedId ? current : null);
  }, [selectedBedId]);

  const shownBeds = beds.map((bed) => preview?.id === bed.id && selectedBedId === bed.id ? preview : bed);
  const selectedBed = shownBeds.find((bed) => bed.id === selectedBedId);
  // Keep movement previews separate so guide updates do not reset the dragged node.
  const guideBed = movePreview?.id === selectedBedId ? movePreview : selectedBed;

  return (
    <>
      {guideBed && <BedAlignmentGuides bed={guideBed} beds={beds} garden={garden}
        pixelsPerCm={pixelsPerCm} dark={dark} />}
      {shownBeds.map((bed) => (
        <BedShape key={bed.id} bed={bed} garden={garden} beds={beds}
          dark={dark} selected={bed.id === selectedBedId}
          onSelect={() => onSelectBed(bed.id)} onMovingChange={(moving) => {
            setMovingId(moving ? bed.id : null);
            if (!moving) setMovePreview(null);
          }} onMovePreview={setMovePreview}
          onMove={onMoveBed} />
      ))}
      {guideBed && <BedDistanceGuides bed={guideBed} beds={beds} garden={garden}
        pixelsPerCm={pixelsPerCm} dark={dark} viewRotationDeg={viewRotationDeg} />}
      {shownBeds.map((bed) => (
        <BedLabel key={bed.id} bed={movePreview?.id === bed.id ? movePreview : bed}
          pixelsPerCm={pixelsPerCm} dark={dark} />
      ))}
      {selectedBed && !movingId && (
        <BedResizeHandles key={selectedBed.id} bed={selectedBed} beds={beds} garden={garden}
          pixelsPerCm={pixelsPerCm} onPreview={setPreview}
          onCommit={(resized) => { onResizeBed(resized.id, resized); setPreview(null); }} />
      )}
    </>
  );
}
