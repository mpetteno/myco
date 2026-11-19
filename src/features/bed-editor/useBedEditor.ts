import { useBedSuggestions } from '../suggestions/useBedSuggestions';
import type { SuggestionContext } from '../suggestions/useBedSuggestions';
import type { PlantingSuggestion } from '../suggestions/suggestionEngine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUndoState } from '../../shared/hooks/useUndoState';
import type { Bed, BedBounds, BedPlans } from '../beds/bed';
import { loadCatalogue } from '../catalogue/catalogueRepository';
import type { Catalogue } from '../catalogue/catalogue';
import { loadMulchCatalogue } from '../mulch-catalogue/mulchCatalogueRepository';
import type { MulchCatalogue } from '../mulch-catalogue/mulchCatalogue';
import { snapshotMulchMaterial } from '../mulch-catalogue/mulchCatalogue';
import { loadSeedMixtures } from '../seed-mixtures/seedMixtureRepository';
import type { SeedMixture } from '../seed-mixtures/seedMixture';
import { snapshotSeedMixture } from '../seed-mixtures/seedMixture';
import { previewPlanting } from '../planting/plantingGeometry';
import { planAdvice } from '../planting/plantingAdvice';
import { DEFAULT_AREA_ROWS, defaultRowDirection, snapshotPlant } from '../planting/plantingPlan';
import { catalogueError } from '../catalogue/catalogueErrors';
import { gardenStorageError } from '../gardens/gardenErrors';
import { freeArea } from '../planting/plantingAreas';
import { MAX_AREAS, emptyMixtureSelection, areaPlanFromBed, emptyAreaPlan, rowPlan, resizePlanAreas, validateAreaPlan } from '../area-editor/areaPlan';
import type { AreaKind, AreaPurpose, BedAreaPlan, PlanArea, SeedSelection } from '../area-editor/areaPlan';

export function useBedEditor({ bed, userId, onSavePlan, beforeLeaving, onBack, suggestionContext }: { bed: Bed; userId: string;
  onSavePlan: (plans: BedPlans) => string | null; beforeLeaving: () => Promise<string | null>; onBack: () => void; preserveFormat?: boolean; suggestionContext?: SuggestionContext }) {
  const readPlan = (source: Bed) => {
    try { return { plan: areaPlanFromBed(source), warning: '' }; }
    catch (problem) { return { plan: emptyAreaPlan(), warning: (problem as Error).message }; }
  };
  const [initial] = useState(() => readPlan(bed));
  const edits = useUndoState<BedAreaPlan>(initial.plan);
  const plan = edits.value, setPlan = edits.setValue;
  const [savedKey, setSavedKey] = useState(() => JSON.stringify(plan));
  const [selectedId, setSelectedId] = useState<string | null>(plan.areas[0]?.id ?? null);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [mixtures, setMixtures] = useState<SeedMixture[]>([]);
  const [mulchCatalogue, setMulchCatalogue] = useState<MulchCatalogue | null>(null);
  const [loading, setLoading] = useState(true), [attempt, setAttempt] = useState(0), [error, setError] = useState(initial.warning);
  const [referenceError, setReferenceError] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false), [leaving, setLeaving] = useState(false);
  const busy = useRef(false), lastAutoAttempt = useRef<string | null>(null);
  useEffect(() => {
    let alive = true; setLoading(true); setReferenceError('');
    void Promise.allSettled([loadCatalogue(userId), loadSeedMixtures(), loadMulchCatalogue(userId)]).then(([plants, seeds, mulch]) => {
      if (!alive) return;
      if (plants.status === 'fulfilled') setCatalogue(plants.value);
      if (seeds.status === 'fulfilled') setMixtures(seeds.value);
      if (mulch.status === 'fulfilled') setMulchCatalogue(mulch.value);
      const failure = [plants, seeds, mulch].find((result) => result.status === 'rejected');
      if (failure?.status === 'rejected') setReferenceError(catalogueError(failure.reason).message);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [userId, attempt]);
  const suggestions = useBedSuggestions(userId, suggestionContext, { bed, plan, selectedId, catalogue, mixtures }, attempt);
  const selected = plan.areas.find((area) => area.id === selectedId);
  const rows = useMemo(() => rowPlan(plan), [plan]);
  const preview = useMemo(() => rows.areas.length ? previewPlanting(rows, bed) : { points: [], rowGuides: [], counts: [], error: null }, [rows, bed]);
  const advice = useMemo(() => catalogue ? planAdvice(rows, catalogue) : [], [rows, catalogue]);
  const validation = useMemo(() => validateAreaPlan(plan, bed), [plan, bed]);
  const draftKey = JSON.stringify(plan), dirty = draftKey !== savedKey;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!dirty || validation || lastAutoAttempt.current === draftKey) return;
    lastAutoAttempt.current = draftKey;
    const problem = onSavePlan({ areaPlan: plan });
    setError(problem ?? '');
    if (!problem) setSavedKey(draftKey);
  });
  function updateArea(id: string, values: Partial<PlanArea>) {
    setPlan((current) => ({ ...current, areas: current.areas.map((area) => area.id === id ? { ...area, ...values } as PlanArea : area) }));
  }
  function bounds(id: string, next: BedBounds) {
    const areas = resizePlanAreas(plan, id, next, bed);
    if (!areas) return 'This position or size would overlap an area, extend outside the bed, or leave too little room for planting.';
    setPlan({ ...plan, areas });
    return null;
  }
  function plantFor(key: string) {
    const cultivar = key.startsWith('cultivar:') ? catalogue?.cultivars?.find((item) => item.id === key.slice(9)) : undefined;
    const crop = catalogue?.plants.find((item) => item.id === (cultivar?.plantTypeId ?? key));
    return crop && catalogue ? snapshotPlant(crop, catalogue, cultivar) : undefined;
  }
  function choosePlant(key: string) {
    if (!selected) return;
    if (key.startsWith('mixture:')) {
      if (selected.kind !== 'broadcast' || selected.purpose !== 'green_manure') return;
      const mixture = mixtures.find((item) => item.id === key.slice(8));
      if (mixture && catalogue) {
        try { updateArea(selected.id, { sowing: { kind: 'mixture', mixture: snapshotSeedMixture(mixture, catalogue) }, densityUnit: 'g_m2', density: selected.densityUnit === 'g_m2' ? selected.density : 0 }); }
        catch (problem) { setError((problem as Error).message); }
      }
      return;
    }
    if (selected.purpose === 'green_manure') return;
    const plant = plantFor(key);
    if (!plant) return;
    if (selected.kind === 'broadcast') updateArea(selected.id, { sowing: { kind: 'crop', plant }, ...(selected.sowing.kind === 'mixture' ? { density: 0, densityUnit: 'g_m2' as const } : {}) });
    if (selected.kind === 'rows') updateArea(selected.id, { plant, plantSpacingCm: plant.plantSpacingCm ?? 0, rowSpacingCm: plant.rowSpacingCm ?? (selected.rowCount != null ? 5 : 0) });
  }
  function applySuggestion(suggestion: PlantingSuggestion) {
    const action = suggestion.action;
    if (!selected || selected.id !== suggestion.areaId || !action) return;
    const base = { id: selected.id, name: selected.name, xCm: selected.xCm, yCm: selected.yCm,
      widthCm: selected.widthCm, lengthCm: selected.lengthCm, mulch: selected.mulch };
    let next: PlanArea;
    if (action.purpose === 'green_manure') {
      const mixture = mixtures.find((m) => `mixture:${m.id}` === action.selectionKey);
      if (!mixture || !catalogue) return;
      try {
        next = { ...base, kind: 'broadcast', purpose: 'green_manure', sowing: { kind: 'mixture', mixture: snapshotSeedMixture(mixture, catalogue) }, density: 0, densityUnit: 'g_m2' };
      } catch (problem) { setError((problem as Error).message); return; }
    } else {
      const plant = plantFor(action.selectionKey);
      if (!plant) return;
      next = selected.kind === 'broadcast'
        ? { ...base, kind: 'broadcast', purpose: 'crop', sowing: { kind: 'crop', plant }, density: selected.sowing.kind === 'crop' ? selected.density : 0, densityUnit: 'g_m2' }
        : { ...base, kind: 'rows', purpose: 'crop', plant, plantSpacingCm: plant.plantSpacingCm ?? 0,
          rowSpacingCm: plant.rowSpacingCm ?? (selected.kind === 'rows' ? selected.rowSpacingCm : 5),
          rowDirection: selected.kind === 'rows' ? selected.rowDirection : defaultRowDirection(bed),
          rowCount: selected.kind === 'rows' ? selected.rowCount : DEFAULT_AREA_ROWS };
    }
    setError('');
    setPlan((current) => ({ ...current, areas: current.areas.map((a) => a.id === selected.id ? next : a) }));
  }
  function changeKind(kind: AreaKind, purpose: AreaPurpose = selected?.purpose ?? 'crop') {
    if (!selected || (selected.kind === kind && selected.purpose === purpose)) return;
    if (kind === 'rows' && purpose !== 'crop') return;
    const base = { id: selected.id, name: selected.name, xCm: selected.xCm, yCm: selected.yCm, widthCm: selected.widthCm, lengthCm: selected.lengthCm, purpose, mulch: selected.mulch };
    let next: PlanArea;
    const plant = selected.kind === 'rows' ? selected.plant : selected.kind === 'broadcast' && selected.sowing.kind === 'crop' ? selected.sowing.plant : plantFor(catalogue?.plants[0]?.id ?? '');
    if (kind === 'rows') {
      if (!plant) { setError('Add a crop to the catalogue before choosing plant rows.'); return; }
      next = { ...base, kind, plant, plantSpacingCm: plant.plantSpacingCm ?? 0, rowSpacingCm: plant.rowSpacingCm ?? 5, rowDirection: defaultRowDirection(bed), rowCount: DEFAULT_AREA_ROWS };
    } else {
      if (!plant) { setError('Add a crop to the catalogue before choosing broadcast sowing for Harvest crop.'); return; }
      const sowing: SeedSelection = { kind: 'crop', plant };
      next = { ...base, kind, sowing, density: 0, densityUnit: 'g_m2' };
    }
    setError(''); setPlan((current) => ({ ...current, areas: current.areas.map((area) => area.id === selected.id ? next : area) }));
  }
  function mixtureSelection() {
    return mixtures[0] && catalogue ? { kind: 'mixture' as const, mixture: snapshotSeedMixture(mixtures[0], catalogue) } : emptyMixtureSelection();
  }
  function changePurpose(purpose: AreaPurpose) {
    if (!selected) return;
    if (purpose !== 'green_manure') {
      if (selected.kind === 'broadcast' && selected.sowing.kind === 'mixture') {
        const plant = plantFor(catalogue?.plants[0]?.id ?? '');
        if (!plant) { setError('Add a crop to the catalogue before choosing Harvest crop.'); return; }
        updateArea(selected.id, { purpose, sowing: { kind: 'crop', plant }, density: 0, densityUnit: 'g_m2' });
      } else updateArea(selected.id, { purpose });
      setError(''); return;
    }
    const { id, name, xCm, yCm, widthCm, lengthCm, mulch } = selected;
    try {
      const existing = selected.kind === 'broadcast' && selected.sowing.kind === 'mixture' ? selected : undefined;
      const next: PlanArea = { id, name, xCm, yCm, widthCm, lengthCm, mulch, purpose, kind: 'broadcast',
        sowing: existing?.sowing ?? mixtureSelection(), density: existing?.density ?? 0, densityUnit: 'g_m2' };
      setError(''); setPlan((current) => ({ ...current, areas: current.areas.map((area) => area.id === id ? next : area) }));
    } catch (problem) { setError((problem as Error).message); }
  }
  function addArea() {
    setError('');
    if (plan.areas.length >= MAX_AREAS) return;
    const position = freeArea(bed, plan.areas);
    if (!position) { setError('No free space. Split or resize an existing area first.'); return; }
    const base = { ...position, id: crypto.randomUUID(), name: '', purpose: 'crop' as const, mulch: [] };
    const plant = plantFor(catalogue?.plants[0]?.id ?? '');
    let area: PlanArea;
    if (plant) area = { ...base, kind: 'rows', plant, plantSpacingCm: plant.plantSpacingCm ?? 0, rowSpacingCm: plant.rowSpacingCm ?? 5, rowDirection: defaultRowDirection(bed), rowCount: DEFAULT_AREA_ROWS };
    else if (mixtures[0] && catalogue) {
      try { area = { ...base, purpose: 'green_manure', kind: 'broadcast', sowing: { kind: 'mixture', mixture: snapshotSeedMixture(mixtures[0], catalogue) }, density: 0, densityUnit: 'g_m2' }; }
      catch (problem) { setError((problem as Error).message); return; }
    } else { setError(loading ? 'Loading planting references…' : 'Add a crop or seed mixture to the catalogue before creating an area.'); return; }
    setPlan({ ...plan, areas: [...plan.areas, area] }); setSelectedId(area.id);
  }
  function splitSelected() {
    if (!selected || plan.areas.length >= MAX_AREAS) return;
    const width = selected.widthCm >= selected.lengthCm, size = width ? selected.widthCm : selected.lengthCm;
    if (size < 10) { setError('This area is too small to split.'); return; }
    const half = Math.floor(size / 10) * 5;
    const first = { ...selected, ...(width ? { widthCm: half } : { lengthCm: half }) };
    const second = { ...structuredClone(selected), id: crypto.randomUUID(), mulch: selected.mulch.map((layer) => ({ ...structuredClone(layer), id: crypto.randomUUID() })),
      ...(width ? { xCm: selected.xCm + half, widthCm: size - half } : { yCm: selected.yCm + half, lengthCm: size - half }) };
    setPlan({ ...plan, areas: plan.areas.flatMap((area) => area.id === selected.id ? [first, second] : [area]) }); setSelectedId(second.id);
  }
  function removeSelected() {
    const areas = plan.areas.filter((area) => area.id !== selectedId);
    setPlan({ ...plan, areas }); setSelectedId(areas[0]?.id ?? null); setError('');
  }
  function addLayer() {
    const material = mulchCatalogue?.types.find((item) => item.available !== false);
    if (selected && material && selected.mulch.length < 8) updateArea(selected.id, { mulch: [...selected.mulch, { id: crypto.randomUUID(), material: snapshotMulchMaterial(material) }] });
  }
  function chooseMaterial(id: string, materialId: string) {
    const material = mulchCatalogue?.types.find((item) => item.id === materialId && item.available !== false);
    if (selected && material) updateArea(selected.id, { mulch: selected.mulch.map((layer) => layer.id === id ? { ...layer, material: snapshotMulchMaterial(material) } : layer) });
  }
  function removeLayer(id: string) { if (selected) updateArea(selected.id, { mulch: selected.mulch.filter((layer) => layer.id !== id) }); }
  function reorderLayer(id: string, step: number) {
    if (!selected) return;
    const layers = [...selected.mulch], index = layers.findIndex((layer) => layer.id === id), target = index + step;
    if (index < 0 || target < 0 || target >= layers.length) return;
    [layers[index], layers[target]] = [layers[target], layers[index]];
    updateArea(selected.id, { mulch: layers });
  }
  function resetFromBed(next: Bed) {
    const loaded = readPlan(next), value = loaded.plan;
    edits.reset(value); setSelectedId(value.areas[0]?.id ?? null); setSavedKey(JSON.stringify(value)); lastAutoAttempt.current = null; setError(loaded.warning);
  }
  async function returnToGarden() {
    if (busy.current) return;
    busy.current = true; setLeaving(true);
    try { const problem = await beforeLeaving(); if (problem) setError(problem); else onBack(); }
    catch (problem) { setError(gardenStorageError(problem).message); }
    finally { busy.current = false; setLeaving(false); }
  }
  function restoreEdit(next: BedAreaPlan | null) {
    if (!next) return;
    lastAutoAttempt.current = null;
    setSelectedId(next.areas.some((area) => area.id === selectedId) ? selectedId : next.areas[0]?.id ?? null);
    setError('');
  }
  function discardDraft() { resetFromBed(bed); }
  return { draft: { plan, setPlan, selected, selectedId, setSelectedId, catalogue, mixtures, loading, error: error || referenceError,
      setError, retry: () => setAttempt((value) => value + 1), updateArea, bounds, choosePlant, changeKind, changePurpose, addArea, splitSelected, removeSelected },
    suggestions, suggestionLocation: suggestionContext?.location, applySuggestion, rows, preview, advice, validation, dirty, leaving, confirmLeave, setConfirmLeave, mulchCatalogue,
    addLayer, chooseMaterial, removeLayer, reorderLayer, canUndo: edits.canUndo, canRedo: edits.canRedo,
    undo: () => restoreEdit(edits.undo()), redo: () => restoreEdit(edits.redo()),
    back: () => { if (dirty) setConfirmLeave(true); else void returnToGarden(); },
    discardAndBack: () => { discardDraft(); setConfirmLeave(false); void returnToGarden(); },
    discardDraft, resetFromBed, clearPlan: () => { lastAutoAttempt.current = null; setPlan(emptyAreaPlan()); setSavedKey(''); setSelectedId(null); setError(''); } };
}
