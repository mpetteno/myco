import { Button } from '../../shared/ui/Button';
import { SelectField } from '../../shared/ui/SelectField';
import type { useBedEditor } from './useBedEditor';
import { areaLabel, MAX_AREAS } from '../area-editor/areaPlan';

export function BedAreaControls({ editor, onFocus }: { editor: ReturnType<typeof useBedEditor>; onFocus: () => void }) {
  const { draft } = editor;
  return <div className="space-y-3">
    {draft.plan.areas.length ? <SelectField id="planting-selected-area" label="Selected area" value={draft.selectedId ?? ''} onChange={(event) => draft.setSelectedId(event.target.value || null)}>
      <option value="">Choose an area</option>{draft.plan.areas.map((area, index) => <option key={area.id} value={area.id}>{index + 1}. {areaLabel(area)}</option>)}
    </SelectField> : <p className="text-sm">Use Add area to plan plant rows or broadcast sowing.</p>}
    {draft.selected && <>
      <Button variant="secondary" onClick={onFocus}>Open area editor</Button>
      <Button variant="secondary" disabled={draft.plan.areas.length >= MAX_AREAS} onClick={draft.splitSelected}>Split selected area</Button>
      <Button variant="danger" onClick={draft.removeSelected}>Remove selected area</Button>
    </>}
  </div>;
}
