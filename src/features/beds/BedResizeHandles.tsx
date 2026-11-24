import { canvasPalette } from '../appearance/canvasPalette';
import { useRef } from 'react';
import type Konva from 'konva';
import { Circle } from 'react-konva';
import type { GardenDimensions } from '../garden/garden';
import type { Bed } from './bed';
import { getResizedBed, getResizeHandlePosition, RESIZE_HANDLES } from './bedResize';
import type { ResizeHandle } from './bedResize';

type BedResizeHandlesProps = {
  bed: Bed;
  beds: Bed[];
  garden: GardenDimensions;
  pixelsPerCm: number;
  dark?: boolean;
  onPreview: (bed: Bed) => void;
  onCommit: (bed: Bed) => void;
  canResize?: (bed: Bed) => boolean;
  onBlocked?: (message: string | null) => void;
};

export function BedResizeHandles({ bed, beds, garden, pixelsPerCm, onPreview, onCommit, canResize, onBlocked, dark = false }: BedResizeHandlesProps) {
  const colors = canvasPalette(dark);
  const gesture = useRef({ original: bed, lastValid: bed });

  function resize(node: Konva.Node, handle: ResizeHandle, reportBlocked = true) {
    const proposed = getResizedBed(gesture.current.original, handle,
      { xCm: node.x(), yCm: node.y() }, garden, beds, reportBlocked ? onBlocked : undefined);
    const resized = proposed && (!canResize || canResize(proposed)) ? proposed : gesture.current.lastValid;
    gesture.current.lastValid = resized;
    const position = getResizeHandlePosition(resized, handle);
    node.position({ x: position.xCm, y: position.yCm });
    onPreview(resized);
    return resized;
  }

  return (
    <>
      {RESIZE_HANDLES.map((handle) => {
        const position = getResizeHandlePosition(bed, handle);
        return (
          <Circle key={handle} x={position.xCm} y={position.yCm}
            radius={5 / pixelsPerCm} fill={colors.handle} stroke={colors.bedBorder}
            strokeWidth={1.5 / pixelsPerCm} hitStrokeWidth={22 / pixelsPerCm}
            draggable
            onDragStart={() => {
              gesture.current = { original: bed, lastValid: bed };
              onPreview(bed);
            }}
            onDragMove={(event) => resize(event.target, handle)}
            // Rejected moves restore the handle to valid bounds. Keep their explanation on drop.
            onDragEnd={(event) => onCommit(resize(event.target, handle, false))} />
        );
      })}
    </>
  );
}
