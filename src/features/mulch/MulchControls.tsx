import { Button } from '../../shared/ui/Button';
import { SelectField } from '../../shared/ui/SelectField';
import { TextField } from '../../shared/ui/TextField';
import { MAX_MULCH_AREAS } from './mulchPlan';
import type { useMulchDraft } from './useMulchDraft';
import { MulchLayers } from './MulchLayers';

export function MulchControls({ draft, onCatalogue, onFocus }: { draft: ReturnType<typeof useMulchDraft>; onCatalogue: () => void; onFocus?: () => void }) {
  const { plan, selected } = draft;
  return <div className="space-y-4">
    <p className="text-sm text-stone-600 dark:text-stone-400">Mulch areas are independent of planting areas. Drag them or their handles on the 5 cm grid. Every layer leaves 5 cm of uncovered soil around each plant.</p>
    {draft.loading && <p role="status" className="text-sm">Loading mulch types…</p>}
    {draft.error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{draft.error}</p>}
    <Button disabled={draft.loading || !draft.catalogue?.types.length || plan.areas.length >= MAX_MULCH_AREAS} onClick={draft.addArea}>Add mulch area</Button>
    {!draft.loading && !draft.catalogue?.types.length && <p className="text-sm">Add mulch types in the catalogue to start covering this bed.</p>}
    {plan.areas.length > 0 && <SelectField id="mulch-area" label="Selected mulch area" value={draft.selectedId ?? ''} onChange={(event) => { draft.setSelectedId(event.target.value); draft.setPreview(null); }}>
      <option value="">Choose an area</option>{plan.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
    </SelectField>}
    {selected && <>
      {onFocus && <Button variant="secondary" onClick={onFocus}>Open area editor</Button>}
      <TextField id="mulch-area-name" label="Area name" required maxLength={100} value={selected.name} onChange={(event) => draft.updateArea(selected.id, { name: event.target.value })} />
      <p className="text-xs text-stone-600 dark:text-stone-400">{selected.widthCm} × {selected.lengthCm} cm. The top layer is visible unless you preview another layer.</p>
      <MulchLayers draft={draft} />
      <Button variant="danger" onClick={draft.removeArea}>Remove selected mulch area</Button>
    </>}
    <Button variant="secondary" onClick={onCatalogue}>Mulch catalogue</Button>
    <Button variant="secondary" disabled={draft.loading} onClick={draft.retry}>Refresh mulch references</Button>
    <p className="text-xs text-stone-600 dark:text-stone-400">Planting and mulch changes save automatically to the plan. Use up to 12 areas and 8 layers per area. Each area needs at least one layer; remove the area to leave its soil uncovered.</p>
  </div>;
}
