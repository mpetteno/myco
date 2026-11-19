import type { BedBounds } from '../beds/bed';
import type { GardenEventSnapshot } from '../history/gardenHistory';
import { compareEvents } from '../history/gardenHistory';
import { areaPlanFromBed } from '../area-editor/areaPlan';
import type { PlanArea } from '../area-editor/areaPlan';
import type { PlantSnapshot } from '../planting/plantingPlan';

export type GroundObservation = BedBounds & { plant: PlantSnapshot; since: string; lastDate: string;
  endedAt?: string; eventId: string; order: number };

export function areaPlants(area: PlanArea): PlantSnapshot[] {
  return area.kind === 'rows' ? [area.plant] : area.kind === 'broadcast'
    ? area.sowing.kind === 'crop' ? [area.sowing.plant] : area.sowing.mixture.components.map((c) => c.plant) : [];
}
export function intersection(a: BedBounds, b: BedBounds): BedBounds | null {
  const xCm = Math.max(a.xCm, b.xCm), yCm = Math.max(a.yCm, b.yCm);
  const widthCm = Math.min(a.xCm + a.widthCm, b.xCm + b.widthCm) - xCm;
  const lengthCm = Math.min(a.yCm + a.lengthCm, b.yCm + b.lengthCm) - yCm;
  return widthCm > 0 && lengthCm > 0 ? { xCm, yCm, widthCm, lengthCm } : null;
}
export function subtract(a: BedBounds, b: BedBounds): BedBounds[] {
  const hit = intersection(a, b);
  if (!hit) return [a];
  return [
    { ...a, lengthCm: hit.yCm - a.yCm },
    { ...a, yCm: hit.yCm + hit.lengthCm, lengthCm: a.yCm + a.lengthCm - hit.yCm - hit.lengthCm },
    { xCm: a.xCm, yCm: hit.yCm, widthCm: hit.xCm - a.xCm, lengthCm: hit.lengthCm },
    { xCm: hit.xCm + hit.widthCm, yCm: hit.yCm, widthCm: a.xCm + a.widthCm - hit.xCm - hit.widthCm, lengthCm: hit.lengthCm },
  ].filter((r) => r.widthCm > 0 && r.lengthCm > 0);
}
export const groundArea = (bounds: BedBounds) => bounds.widthCm * bounds.lengthCm;

// Identity is crop + physical rectangle, never a bed or area ID. Checkpoints
// extend observations; they are not sowing events. Absence supplies an upper
// bound on removal, not a harvest date.
export function groundHistory(events: GardenEventSnapshot[], date: string): GroundObservation[] {
  const result: GroundObservation[] = [];
  let active = new Map<string, GroundObservation>();
  for (const event of [...events].filter((e) => e.status !== 'planned' && e.date <= date).sort(compareEvents)) {
    const next = new Map<string, GroundObservation>();
    for (const bed of event.document.beds) for (const area of areaPlanFromBed(bed).areas) {
      const bounds = { xCm: bed.xCm + area.xCm, yCm: bed.yCm + area.yCm, widthCm: area.widthCm, lengthCm: area.lengthCm };
      for (const plant of areaPlants(area)) {
        const key = JSON.stringify([plant.id, plant.cultivarId, plant.familyId, bounds]);
        const observation = active.get(key) ?? { ...bounds, plant, since: event.date, lastDate: event.date, eventId: event.id, order: event.order };
        if (!active.has(key)) result.push(observation);
        Object.assign(observation, { lastDate: event.date, eventId: event.id, order: event.order });
        next.set(key, observation);
      }
    }
    for (const [key, observation] of active) if (!next.has(key)) observation.endedAt = event.date;
    active = next;
  }
  return result;
}

// Pick the most recently observed crops independently on each portion of ground.
// Components observed together share precedence and must all remain represented.
export function precedingCrops(observations: GroundObservation[], target: BedBounds) {
  const ordered = [...observations].sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.order - a.order);
  let uncovered = [target];
  const result: { observation: GroundObservation; overlap: number }[] = [];
  for (let i = 0; i < ordered.length;) {
    const first = ordered[i], group: GroundObservation[] = [];
    while (i < ordered.length && ordered[i].eventId === first.eventId) group.push(ordered[i++]);
    for (const observation of group) {
      const overlap = uncovered.reduce((sum, r) => sum + (intersection(r, observation) ? groundArea(intersection(r, observation)!) : 0), 0);
      if (overlap) result.push({ observation, overlap });
    }
    for (const observation of group) uncovered = uncovered.flatMap((r) => subtract(r, observation));
  }
  return { crops: result, unknownArea: uncovered.reduce((sum, r) => sum + groundArea(r), 0) };
}
