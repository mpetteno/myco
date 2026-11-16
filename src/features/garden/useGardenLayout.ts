import { useRef, useState } from 'react';
import { bedsOverlap, findFreePosition, isInsideGarden } from '../beds/bed';
import type { Bed, BedBounds, BedDetails } from '../beds/bed';
import { getBedMovePosition } from '../beds/bedMovement';
import type { BedPosition } from '../beds/bedMovement';
import { canResizeBed } from '../beds/bedResize';
import { getPastedBed } from '../beds/bedOperations';
import type { GardenDimensions } from './garden';
import type { GardenDocument } from '../gardens/gardenDocument';

export function useGardenLayout(initial: GardenDocument, onChange: (document: GardenDocument) => void) {
  const [document, setDocument] = useState(initial);
  const snapshot = useRef(initial);
  const nextBedId = useRef(1);

  function commit(next: GardenDocument) {
    snapshot.current = next;
    setDocument(next);
    onChange(next);
  }
  function setBeds(beds: Bed[]) { commit({ ...snapshot.current, beds }); }
  function nextId() {
    while (snapshot.current.beds.some((bed) => bed.id === `bed-${nextBedId.current}`)) nextBedId.current++;
    return `bed-${nextBedId.current++}`;
  }

  function applyDimensions(next: GardenDimensions): string | null {
    if (snapshot.current.beds.some((bed) => !isInsideGarden(bed, next))) {
      return 'These garden dimensions would put a bed outside the garden. Keep the garden large enough for every bed.';
    }
    commit({ ...snapshot.current, dimensions: next });
    return null;
  }

  function saveBed(details: BedDetails, bedId?: string): string | null {
    const { dimensions, beds } = snapshot.current;
    const current = beds.find((bed) => bed.id === bedId);

    if (current) {
      const updated: Bed = { ...current, ...details };
      if (!isInsideGarden(updated, dimensions)) return 'This bed would extend outside the garden. Choose smaller dimensions.';
      if (beds.some((bed) => bed.id !== bedId && bedsOverlap(updated, bed))) {
        return 'This size would overlap another bed. Choose smaller dimensions.';
      }
      setBeds(beds.map((bed) => bed.id === bedId ? updated : bed));
    } else {
      const position = findFreePosition(details, dimensions, beds);
      if (!position) return 'No free space fits this bed. Choose smaller dimensions or enlarge the garden.';
      setBeds([...beds, { ...details, ...position, id: nextId() }]);
    }
    return null;
  }

  function moveBed(bedId: string, proposed: BedPosition) {
    const { dimensions, beds } = snapshot.current;
    // Validate against current state again when committing, including other drags.
    setBeds(beds.map((bed) => {
      if (bed.id !== bedId) return bed;
      const position = getBedMovePosition(bed, proposed, dimensions, beds);
      return { ...bed, ...(position ?? { xCm: bed.xCm, yCm: bed.yCm }) };
    }));
  }

  function resizeBed(bedId: string, bounds: BedBounds) {
    const { dimensions, beds } = snapshot.current;
    setBeds(beds.map((bed) => {
      if (bed.id !== bedId) return bed;
      const resized = { ...bed, xCm: bounds.xCm, yCm: bounds.yCm, widthCm: bounds.widthCm, lengthCm: bounds.lengthCm };
      return canResizeBed(resized, dimensions, beds) ? resized : { ...bed };
    }));
  }

  function pasteBed(copied: BedDetails): Bed | null {
    const { dimensions, beds } = snapshot.current;
    const pasted = getPastedBed(copied, dimensions, beds, nextId());
    if (!pasted) return null;
    setBeds([...beds, pasted]);
    return pasted;
  }

  function deleteBed(bedId: string) {
    setBeds(snapshot.current.beds.filter((bed) => bed.id !== bedId));
  }

  function renameGarden(name: string): string | null {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) return 'Enter a garden name of 1 to 100 characters.';
    commit({ ...snapshot.current, name: trimmed });
    return null;
  }

  return { ...document, applyDimensions, saveBed, moveBed, resizeBed, pasteBed, deleteBed, renameGarden };
}
