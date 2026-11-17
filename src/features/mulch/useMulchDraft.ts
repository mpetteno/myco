import { snapshotMulchMaterial } from '../mulch-catalogue/mulchCatalogue';
import { useEffect, useState } from 'react';
import type { Bed, BedBounds } from '../beds/bed';
import { loadMulchCatalogue } from '../mulch-catalogue/mulchCatalogueRepository';
import { mulchCatalogueError } from '../mulch-catalogue/mulchCatalogueErrors';
import type { MulchCatalogue, MulchType } from '../mulch-catalogue/mulchCatalogue';
import { freeMulchArea, reorderMulchLayer } from './mulchAreas';
import { resizeAreas } from '../area-editor/resizeAreas';
import type { BedMulchPlan, MulchArea } from './mulchPlan';
import { MAX_MULCH_AREAS, MAX_MULCH_LAYERS } from './mulchPlan';
import type { MulchLayerPreview } from './mulchRendering';

export function useMulchDraft(bed: Bed, userId: string) {
  const [plan, setPlan] = useState<BedMulchPlan>(() => structuredClone(bed.mulchPlan ?? { version: 1, areas: [] }));
  const [selectedId, setSelectedId] = useState<string | null>(plan.areas[0]?.id ?? null);
  const [catalogue, setCatalogue] = useState<MulchCatalogue | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<MulchLayerPreview>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    void loadMulchCatalogue(userId).then((data) => { if (alive) setCatalogue(data); })
      .catch((problem) => { if (alive) setError(mulchCatalogueError(problem).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId, attempt]);
  const available = catalogue?.types.filter((item) => item.available !== false) ?? [];
  const selected = plan.areas.find((area) => area.id === selectedId);
  function updateArea(id: string, values: Partial<MulchArea>) {
    setPlan((current) => ({ ...current, areas: current.areas.map((area) => area.id === id ? { ...area, ...values } : area) }));
  }
  function bounds(id: string, next: BedBounds) {
    const areas = resizeAreas(plan.areas, id, next, bed);
    if (areas) setPlan({ ...plan, areas });
  }
  const newLayer = (material: MulchType) => ({ id: crypto.randomUUID(), material: snapshotMulchMaterial(material) });
  function addArea() {
    setError('');
    if (!available.length || plan.areas.length >= MAX_MULCH_AREAS) return;
    const position = freeMulchArea(bed, plan.areas);
    if (!position) { setError('No free mulch space. Resize or remove an existing mulch area first.'); return; }
    const area = { ...position, id: crypto.randomUUID(), name: `Mulch area ${plan.areas.length + 1}`, layers: [newLayer(available[0])] };
    setPlan({ ...plan, areas: [...plan.areas, area] }); setSelectedId(area.id); setPreview(null);
  }
  function addLayer() {
    if (!selected || !available.length || selected.layers.length >= MAX_MULCH_LAYERS) return;
    updateArea(selected.id, { layers: [...selected.layers, newLayer(available[0])] }); setPreview(null);
  }
  function chooseMaterial(layerId: string, materialId: string) {
    const material = catalogue?.types.find((item) => item.id === materialId);
    if (selected && material && material.available !== false) updateArea(selected.id, { layers: selected.layers.map((layer) => layer.id === layerId ? { ...layer, material: snapshotMulchMaterial(material) } : layer) });
  }
  function reorderLayer(id: string, direction: -1 | 1) {
    if (selected) updateArea(selected.id, { layers: reorderMulchLayer(selected.layers, id, direction) });
  }
  function removeLayer(id: string) {
    if (!selected || selected.layers.length <= 1) return;
    updateArea(selected.id, { layers: selected.layers.filter((layer) => layer.id !== id) }); setPreview(null);
  }
  function removeArea() {
    const areas = plan.areas.filter((area) => area.id !== selectedId);
    setPlan({ ...plan, areas }); setSelectedId(areas[0]?.id ?? null); setPreview(null); setError('');
  }
  function resetPlan(next?: BedMulchPlan) {
    const value = structuredClone(next ?? { version: 1 as const, areas: [] });
    setPlan(value); setSelectedId(value.areas[0]?.id ?? null); setPreview(null); setError('');
  }
  return { plan, selected, selectedId, setSelectedId, catalogue, loading, error, preview, setPreview,
    retry: () => setAttempt((value) => value + 1), bounds, updateArea, addArea, addLayer, chooseMaterial, reorderLayer, removeLayer, removeArea, resetPlan };
}
