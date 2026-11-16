import type { GardenEventSnapshot } from './gardenHistory';
import { compareEvents } from './gardenHistory';
import type { GardenDocument } from '../gardens/gardenDocument';

// Layout records establish the whole garden. A completed activity confirms only
// its target bed, so proposals for other beds never become actual history.
export function actualHistory(events: GardenEventSnapshot[], target: GardenEventSnapshot): GardenDocument {
  let document: GardenDocument | null = null;
  for (const event of [...events].sort(compareEvents)) {
    if (compareEvents(event, target) > 0 || event.status === 'planned') continue;
    if (!event.kind || event.kind === 'layout') document = structuredClone(event.document);
    else {
      const bed = event.document.beds.find((item) => item.id === event.bedId);
      if (!bed) continue;
      document ??= { name: event.document.name, dimensions: { ...event.document.dimensions }, beds: [] };
      document.beds = [...document.beds.filter((item) => item.id !== bed.id), structuredClone(bed)];
      // A confirmed bed may extend the last recorded garden bounds.
      document.dimensions.widthCm = Math.max(document.dimensions.widthCm, bed.xCm + bed.widthCm);
      document.dimensions.lengthCm = Math.max(document.dimensions.lengthCm, bed.yCm + bed.lengthCm);
    }
  }
  return document ?? { name: target.document.name, dimensions: target.document.dimensions, beds: [] };
}
