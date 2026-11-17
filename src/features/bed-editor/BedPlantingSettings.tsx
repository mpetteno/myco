import { Button } from '../../shared/ui/Button';
import type { Bed } from '../beds/bed';
import type { useBedEditor } from './useBedEditor';

export function BedPlantingSettings({ bed, editor }: { bed: Bed; editor: ReturnType<typeof useBedEditor> }) {
  const { draft } = editor;
  return <section className="space-y-3 border-t border-stone-200 pt-4 dark:border-stone-800" aria-label="Area settings">
    <h3 className="font-semibold">Area settings</h3>
    <Button variant="secondary" disabled={draft.loading} onClick={draft.retry}>Refresh area references</Button>
    {(bed.areaPlan || bed.plantingPlan || draft.plan.areas.length > 0) && <Button variant="danger" onClick={editor.clearPlan}>Clear area plan</Button>}
  </section>;
}
