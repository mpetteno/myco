import { Button } from '../../shared/ui/Button';
import type { Bed } from '../beds/bed';
import type { useBedEditor } from './useBedEditor';

export function BedPlantingSettings({ bed, editor, onCatalogue }: { bed: Bed; editor: ReturnType<typeof useBedEditor>;
  onCatalogue: () => void }) {
  const { draft } = editor;
  return <section className="space-y-3 border-t border-stone-200 pt-4 dark:border-stone-800" aria-label="Planting settings">
    <h3 className="font-semibold">Planting settings</h3>
    <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 shrink-0 accent-green-700" checked={draft.plan.respectAreaSpacing}
      onChange={(event) => draft.setPlan({ ...draft.plan, respectAreaSpacing: event.target.checked })} />Keep spacing between areas using the larger requirement</label>
    <p className="text-xs text-stone-600 dark:text-stone-400">Spacing overrides and companion cautions remain advisory. Valid planting and mulch changes save automatically.</p>
    <Button variant="secondary" onClick={onCatalogue}>Plant catalogue</Button>
    <Button variant="secondary" disabled={draft.loading} onClick={draft.retry}>Refresh planting references</Button>
    {(bed.plantingPlan || draft.plan.areas.length > 0) && <Button variant="danger" onClick={editor.clearPlan}>Clear planting plan</Button>}
  </section>;
}
