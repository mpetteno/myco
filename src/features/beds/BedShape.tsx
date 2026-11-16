import { canvasPalette } from '../appearance/canvasPalette';
import { useLayoutEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { Group, Rect } from 'react-konva';
import type { GardenDimensions } from '../garden/garden';
import type { Bed } from './bed';
import { getBedMovePosition } from './bedMovement';
import type { BedPosition } from './bedMovement';
import { BedPlantingMarks } from '../planting/BedPlantingMarks';

type BedShapeProps = {
  bed: Bed;
  dark: boolean;
  garden: GardenDimensions;
  beds: Bed[];
  onMove: (bedId: string, position: BedPosition) => void;
  selected: boolean;
  onSelect: () => void;
  onOpen?: () => void;
  onMovingChange: (moving: boolean) => void;
  onMovePreview: (bed: Bed) => void;
  pixelsPerCm: number;
  readOnly?: boolean;
};

export function BedShape({ bed, dark, garden, beds, onMove, selected, onSelect, onOpen, onMovingChange, onMovePreview, pixelsPerCm, readOnly = false }: BedShapeProps) {
  const colors = canvasPalette(dark);
  const groupRef = useRef<Konva.Group>(null);
  const lastValidPosition = useRef<BedPosition>({ xCm: bed.xCm, yCm: bed.yCm });
  const [isDragging, setIsDragging] = useState(false);

  useLayoutEffect(() => {
    // Reconcile with model state even when a rejected drop keeps the same coordinates.
    groupRef.current?.position({ x: bed.xCm, y: bed.yCm });
  }, [bed]);

  function constrainDrag(node: Konva.Node) {
    // Node coordinates are relative to the scaled layer, so they are already cm.
    const position = getBedMovePosition(bed, { xCm: node.x(), yCm: node.y() }, garden, beds)
      ?? lastValidPosition.current;
    lastValidPosition.current = position;
    // Update the node too: unchanged React props alone will not undo an invalid drag.
    node.position({ x: position.xCm, y: position.yCm });
    onMovePreview({ ...bed, ...position });
    return position;
  }

  return (
    <Group ref={groupRef} x={bed.xCm} y={bed.yCm} clipWidth={bed.widthCm} clipHeight={bed.lengthCm}
      draggable={!readOnly}
      onClick={onSelect} onTap={onSelect}
      onDblClick={() => { if (!readOnly) onOpen?.(); }}
      onDragStart={() => {
        lastValidPosition.current = { xCm: bed.xCm, yCm: bed.yCm };
        setIsDragging(true);
        onSelect();
        onMovingChange(true);
      }}
      onDragMove={(event) => constrainDrag(event.target)}
      onDragEnd={(event) => {
        const position = constrainDrag(event.target);
        onMove(bed.id, position);
        setIsDragging(false);
        onMovingChange(false);
      }}>
      <Rect width={bed.widthCm} height={bed.lengthCm}
        fill={colors.bed}
        stroke={isDragging || selected ? colors.selected : colors.bedBorder}
        strokeWidth={isDragging || selected ? 3 : 1.5} strokeScaleEnabled={false} />
      <BedPlantingMarks dark={dark} bed={bed} pixelsPerCm={pixelsPerCm} />
    </Group>
  );
}
