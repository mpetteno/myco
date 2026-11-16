import type { BedBounds } from '../beds/bed';
import { bedsOverlap } from '../beds/bed';
import { canResizeBed } from '../beds/bedResize';
import type { GardenDimensions } from '../garden/garden';

type Area = BedBounds & { id: string };

// An expanding edge takes space from neighbours on that side. Their opposite
// edges stay fixed; shrinking never moves an unrelated area or creates a gap.
export function resizeAreas<T extends Area>(areas: T[], id: string, bounds: BedBounds, bed: GardenDimensions): T[] | null {
  const source = areas.find((area) => area.id === id);
  if (!source) return null;
  const next = { ...source, xCm: bounds.xCm, yCm: bounds.yCm, widthCm: bounds.widthCm, lengthCm: bounds.lengthCm };
  if (!canResizeBed({ ...next, name: '' }, bed, [])) return null;
  const moving = next.widthCm === source.widthCm && next.lengthCm === source.lengthCm;
  const result: T[] = [];
  for (const area of areas) {
    if (area.id === id) { result.push(next); continue; }
    if (!bedsOverlap(next, area)) { result.push(area); continue; }
    if (moving) return null;
    let left = area.xCm, top = area.yCm;
    let right = left + area.widthCm, bottom = top + area.lengthCm;
    if (next.xCm < source.xCm && right <= source.xCm) right = next.xCm;
    if (next.yCm < source.yCm && bottom <= source.yCm) bottom = next.yCm;
    if (next.xCm + next.widthCm > source.xCm + source.widthCm && left >= source.xCm + source.widthCm) left = next.xCm + next.widthCm;
    if (next.yCm + next.lengthCm > source.yCm + source.lengthCm && top >= source.yCm + source.lengthCm) top = next.yCm + next.lengthCm;
    const smaller = { ...area, xCm: left, yCm: top, widthCm: right - left, lengthCm: bottom - top };
    if (!canResizeBed({ ...smaller, name: '' }, bed, []) || bedsOverlap(next, smaller)) return null;
    result.push(smaller);
  }
  return result;
}
