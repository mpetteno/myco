import { useEffect, useState } from 'react';
import type { SetStateAction } from 'react';
import type { Bed, BedBounds } from '../beds/bed';
import { loadCatalogue } from '../catalogue/catalogueRepository';
import { catalogueError } from '../catalogue/catalogueErrors';
import type { Catalogue } from '../catalogue/catalogue';
import { freeArea, splitArea } from './plantingAreas';
import { MAX_PLANTING_AREAS, DEFAULT_AREA_ROWS, snapshotPlant, defaultRowDirection, editablePlantingPlan } from './plantingPlan';
import type { BedPlantingPlan, PlantingArea } from './plantingPlan';
import { resizePlantingAreas } from './areaResize';

export function usePlantingDraft(bed: Bed, userId: string, preserveFormat = false) {
  const [plan, setPlanState] = useState<BedPlantingPlan>(() => editablePlantingPlan(bed, bed.plantingPlan, preserveFormat));
  function setPlan(value: SetStateAction<BedPlantingPlan>) {
    setPlanState((current) => {
      const next = typeof value === 'function' ? value(current) : value;
      return preserveFormat && next.version !== 5 ? editablePlantingPlan(bed, next) : next;
    });
  }
  const [selectedId, setSelectedId] = useState<string | null>(plan.areas[0]?.id ?? null);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    void loadCatalogue(userId).then((data) => { if (alive) setCatalogue(data); })
      .catch((problem) => { if (alive) setError(catalogueError(problem).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId, attempt]);
  const selected = plan.areas.find((area) => area.id === selectedId);
  function updateArea(id: string, values: Partial<PlantingArea>) {
    setPlan((current) => ({ ...current, areas: current.areas.map((area) => area.id === id ? { ...area, ...values } : area) }));
  }
  function bounds(id: string, next: BedBounds) {
    const areas = resizePlantingAreas(plan, id, next, bed);
    if (areas) setPlan({ ...plan, areas });
  }
  function choosePlant(id: string) {
    const type = catalogue?.plants.find((item) => item.id === id);
    if (!selected || !type || !catalogue) return;
    const plant = snapshotPlant(type, catalogue);
    updateArea(selected.id, { plant, plantSpacingCm: plant.plantSpacingCm ?? 0, rowSpacingCm: plant.rowSpacingCm ?? (selected.rowCount != null ? 5 : 0) });
  }
  function addArea() {
    setError('');
    if (!catalogue?.plants.length) return;
    if (plan.areas.length >= MAX_PLANTING_AREAS) { setError(`Use up to ${MAX_PLANTING_AREAS} areas per bed.`); return; }
    const position = freeArea(bed, plan.areas);
    if (!position) { setError('No free space. Split or resize an existing area first.'); return; }
    const plant = snapshotPlant(catalogue.plants[0], catalogue);
    const area: PlantingArea = { ...position, id: crypto.randomUUID(), plant, plantSpacingCm: plant.plantSpacingCm ?? 0,
      rowSpacingCm: plant.rowSpacingCm ?? 5, rowDirection: defaultRowDirection(bed), rowCount: DEFAULT_AREA_ROWS };
    setPlan({ ...plan, areas: [...plan.areas, area] }); setSelectedId(area.id);
  }
  function splitSelected() {
    setError('');
    if (!selected || plan.areas.length >= MAX_PLANTING_AREAS) return;
    const halves = splitArea(selected, crypto.randomUUID());
    if (!halves) { setError('This area is too small to split.'); return; }
    setPlan({ ...plan, areas: plan.areas.flatMap((area) => area.id === selected.id ? halves : [area]) });
    setSelectedId(halves[1].id);
  }
  function removeSelected() {
    const areas = plan.areas.filter((area) => area.id !== selectedId);
    setPlan({ ...plan, areas, advice: [] }); setSelectedId(areas[0]?.id ?? null); setError('');
  }
  function resetPlan(next?: BedPlantingPlan) {
    const value = editablePlantingPlan(bed, next, preserveFormat);
    setPlanState(value); setSelectedId(value.areas[0]?.id ?? null); setError('');
  }
  return { plan, setPlan, selected, selectedId, setSelectedId, catalogue, loading, error, setError,
    retry: () => setAttempt((value) => value + 1), updateArea, bounds, choosePlant, addArea, splitSelected, removeSelected, resetPlan };
}
