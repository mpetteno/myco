import { Button } from '../../shared/ui/Button';
import { SelectField } from '../../shared/ui/SelectField';
import { MAX_MULCH_LAYERS } from './mulchPlan';
import type { useMulchDraft } from './useMulchDraft';

export function MulchLayers({ draft }: { draft: ReturnType<typeof useMulchDraft> }) {
  const { selected, catalogue } = draft;
  if (!selected) return null;
  return <div className="space-y-3">
    <h3 className="text-sm font-semibold">Layers · bottom to top</h3>
    <ol className="space-y-3">{selected.layers.map((layer, index) => <li key={layer.id} className="space-y-3 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
      <SelectField id={`mulch-layer-${layer.id}`} label={`Layer ${index + 1}${index === selected.layers.length - 1 ? ' (top)' : index === 0 ? ' (bottom)' : ''}`}
        value={layer.material.id} disabled={draft.loading || !catalogue} onChange={(event) => draft.chooseMaterial(layer.id, event.target.value)}>
        {!catalogue?.types.some((item) => item.id === layer.material.id) && <option value={layer.material.id}>{layer.material.name} (saved reference)</option>}
        {catalogue?.types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </SelectField>
      {layer.material.notes && <p className="break-words text-xs text-stone-600 dark:text-stone-400">{layer.material.notes}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={index === 0} aria-label={`Move layer ${index + 1} down`} onClick={() => draft.reorderLayer(layer.id, -1)}>↓ Lower</Button>
        <Button variant="secondary" disabled={index === selected.layers.length - 1} aria-label={`Move layer ${index + 1} up`} onClick={() => draft.reorderLayer(layer.id, 1)}>↑ Higher</Button>
        <Button variant="secondary" aria-pressed={draft.preview?.areaId === selected.id && draft.preview.layerId === layer.id}
          onClick={() => draft.setPreview({ areaId: selected.id, layerId: layer.id })}>Preview layer {index + 1}</Button>
        <Button variant="secondary" disabled={selected.layers.length === 1} aria-label={`Remove layer ${index + 1}`} onClick={() => draft.removeLayer(layer.id)}>Remove</Button>
      </div>
    </li>)}</ol>
    <Button disabled={draft.loading || !catalogue?.types.length || selected.layers.length >= MAX_MULCH_LAYERS} onClick={draft.addLayer}>Add layer on top</Button>
    {draft.preview && <Button variant="secondary" onClick={() => draft.setPreview(null)}>Show top layers</Button>}
  </div>;
}
