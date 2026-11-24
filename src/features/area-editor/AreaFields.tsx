import { CropCultivarFields } from '../planting/CropCultivarFields';
import { Button } from '../../shared/ui/Button';
import { SelectField } from '../../shared/ui/SelectField';
import { NumberField } from '../../shared/ui/NumberField';
import { GeometryForm } from '../../shared/ui/GeometryForm';
import type { Bed } from '../beds/bed';
import type { useBedEditor } from '../bed-editor/useBedEditor';
import { PlantingAreaFields } from '../planting/PlantingAreaFields';
import { plantLabel } from '../planting/plantingPlan';
import { sowingQuantity } from './areaPlan';
import type { AreaKind, AreaPurpose } from './areaPlan';

export function AreaFields({ bed, editor }: { bed: Bed; editor: ReturnType<typeof useBedEditor> }) {
  const { draft } = editor, area = draft.selected;
  if (!area) return null;
  const savedMixture = area.kind === 'broadcast' && area.purpose === 'green_manure' && area.sowing.kind === 'mixture' ? area.sowing.mixture : undefined;
  const quantity = area.kind === 'broadcast' && ((area.purpose === 'crop' && area.sowing.kind === 'crop') || (area.purpose === 'green_manure' && area.sowing.kind === 'mixture')) ? sowingQuantity(area) : null;
  const number = (value: number) => Number(value.toFixed(4));
  return <div className="space-y-4">
    <SelectField id="area-purpose" label="Purpose" value={area.purpose} onChange={(event) => draft.changePurpose(event.target.value as AreaPurpose)}>
      <option value="crop">Harvest crop</option><option value="green_manure">Green manure</option>
    </SelectField>
    {area.purpose === 'crop' && <SelectField id="area-kind" label="Planting method" value={area.kind === 'unplanted' ? '' : area.kind} onChange={(event) => draft.changeKind(event.target.value as AreaKind)}>
      {area.kind === 'unplanted' && <option value="" disabled>Choose a planting method</option>}
      <option value="rows">Plant rows</option><option value="broadcast">Broadcast sowing</option>
    </SelectField>}
    {area.kind === 'rows' && draft.catalogue && <PlantingAreaFields area={area} plan={editor.rows} bed={bed} catalogue={draft.catalogue} onPlant={draft.choosePlant} onChange={(values) => draft.updateArea(area.id, values)} />}
    {area.kind === 'broadcast' && <>
      {area.purpose === 'crop' && draft.catalogue && <CropCultivarFields idPrefix="broadcast" catalogue={draft.catalogue} plant={area.sowing.kind === 'crop' ? area.sowing.plant : undefined} onPlant={draft.choosePlant} />}
      {savedMixture && <SelectField id="seed-mixture" label="Seed mixture" value={savedMixture.id} onChange={(event) => draft.choosePlant(`mixture:${event.target.value}`)}>
        {!savedMixture.id && <option value="" disabled>Choose a seed mixture</option>}
        {savedMixture.id && !draft.mixtures.some((mixture) => mixture.id === savedMixture.id) && <option value={savedMixture.id}>{savedMixture.name} (saved reference)</option>}
        {draft.mixtures.map((mixture) => <option key={mixture.id} value={mixture.id}>{mixture.name}</option>)}
      </SelectField>}
      {savedMixture && !savedMixture.id && !draft.loading && !draft.mixtures.length && <p role="alert" className="text-sm text-red-700 dark:text-red-400">No seed mixtures are available.</p>}
      <NumberField id="broadcast-density" label="Sowing density" unit="g/m²" min={0.000001} max={1000000} step="any" required value={area.density || ''} onChange={(event) => draft.updateArea(area.id, { density: Number(event.target.value) })} />
      {quantity && <div className="space-y-3">
        <NumberField id="broadcast-total" label="Total seed required" unit="g" readOnly value={number(quantity.total)} />
        {area.sowing.kind === 'mixture' && <fieldset className="space-y-3"><legend className="text-sm font-medium">Mixture components</legend>
          {area.sowing.mixture.components.map((component, index) => <NumberField key={index} id={`broadcast-component-${index}`} label={`${plantLabel(component.plant)} · ${component.percentage}%`} unit="g" readOnly value={number(quantity.components[index].grams)} />)}
        </fieldset>}
      </div>}
    </>}
    <AreaMulchLayers editor={editor} />
    <GeometryForm key={area.id} id="area-bounds" container="bed" size value={area} onSave={(next) => draft.bounds(area.id, next)} />
  </div>;
}
function AreaMulchLayers({ editor }: { editor: ReturnType<typeof useBedEditor> }) {
  const area = editor.draft.selected, catalogue = editor.mulchCatalogue;
  if (!area) return null;
  return <details id="area-mulch-controls" aria-label="Area mulch" className="space-y-3 border-t border-stone-200 pt-3 dark:border-stone-700">
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Mulch · {area.mulch.length} {area.mulch.length === 1 ? 'layer' : 'layers'}</summary>
    <ol className="space-y-3">{area.mulch.map((layer, index) => <li key={layer.id} className="space-y-3 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
      <SelectField id={`mulch-layer-${layer.id}`} label={`Layer ${index + 1}${index === area.mulch.length - 1 ? ' (top)' : ''}`} value={layer.material.id} onChange={(event) => editor.chooseMaterial(layer.id, event.target.value)}>
        {!catalogue?.types.some((type) => type.id === layer.material.id && type.available !== false) && <option value={layer.material.id}>{layer.material.name} (saved reference)</option>}
        {catalogue?.types.filter((type) => type.available !== false).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
      </SelectField>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" disabled={index === 0} aria-label={`Move layer ${index + 1} down`} onClick={() => editor.reorderLayer(layer.id, -1)}>↓ Lower</Button>
        <Button variant="secondary" disabled={index === area.mulch.length - 1} aria-label={`Move layer ${index + 1} up`} onClick={() => editor.reorderLayer(layer.id, 1)}>↑ Higher</Button>
        <Button variant="danger" aria-label={`Remove layer ${index + 1}`} onClick={() => editor.removeLayer(layer.id)}>Remove</Button>
      </div>
    </li>)}</ol>
    <Button variant="secondary" disabled={editor.draft.loading || !catalogue?.types.some((type) => type.available !== false) || area.mulch.length >= 8} onClick={editor.addLayer}>Add mulch layer</Button>
  </details>;
}
