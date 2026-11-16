import { Button } from '../../shared/ui/Button';
import { SelectField } from '../../shared/ui/SelectField';
import { PlantingAreaFields } from '../planting/PlantingAreaFields';
import { MAX_PLANTING_AREAS } from '../planting/plantingPlan';
import type { usePlantingDraft } from '../planting/usePlantingDraft';
import type { Bed } from '../beds/bed';

export function BedAreaControls({ draft, bed, onFocus }: { draft: ReturnType<typeof usePlantingDraft>; bed: Bed; onFocus?: () => void }) {
  const { plan, selected, catalogue } = draft;
  return <div className="space-y-4">
    <p className="text-sm text-stone-600 dark:text-stone-400">Choose an area in the drawing or list. Drag it or its handles to move and resize it.</p>
    {plan.areas.length > 0 && <SelectField id="planting-area" label="Selected area" value={draft.selectedId ?? ''} onChange={(event) => draft.setSelectedId(event.target.value)}>
      <option value="">Choose an area</option>{plan.areas.map((area, index) => <option key={area.id} value={area.id}>Area {index + 1} · {area.plant.name}</option>)}
    </SelectField>}
    {!selected && <p className="text-sm">{plan.areas.length ? 'Select an area to edit its plant type and spacing.' : 'Use Add area to start planting this bed.'}</p>}
    {draft.loading && <p role="status" className="text-sm">Loading planting references…</p>}
    {selected && catalogue && !draft.loading && <PlantingAreaFields area={selected} plan={plan} bed={bed} catalogue={catalogue}
      onPlant={draft.choosePlant} onChange={(values) => draft.updateArea(selected.id, values)} />}
    {selected && <>
      {onFocus && <Button variant="secondary" onClick={onFocus}>Open area editor</Button>}
      <Button variant="secondary" disabled={plan.areas.length >= MAX_PLANTING_AREAS || Math.max(selected.widthCm, selected.lengthCm) < 10} onClick={draft.splitSelected}>Split selected area</Button>
      <Button variant="danger" onClick={draft.removeSelected}>Remove selected area</Button>
    </>}
    <p className="text-xs text-stone-600 dark:text-stone-400">The first area fills the bed. Split divides an area along its longer side. Custom spacing changes only this plan.</p>
  </div>;
}
