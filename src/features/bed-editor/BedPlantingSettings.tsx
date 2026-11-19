import { useState } from 'react';
import { Button } from '../../shared/ui/Button';
import { Sheet } from '../../shared/ui/Sheet';
import type { Bed } from '../beds/bed';
import type { useBedEditor } from './useBedEditor';

export function BedPlantingSettings({ bed, editor }: { bed: Bed; editor: ReturnType<typeof useBedEditor> }) {
  const { draft } = editor;
  const [confirmClear, setConfirmClear] = useState(false);
  return <details className="space-y-3 border-t border-stone-200 pt-3 dark:border-stone-800">
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Plan tools</summary>
    <p className="text-sm text-stone-600 dark:text-stone-400">Refresh available crops, mixtures and mulch materials. Your saved planting choices stay unchanged.</p>
    <Button variant="secondary" disabled={draft.loading} onClick={draft.retry}>Refresh area references</Button>
    {(bed.areaPlan || bed.plantingPlan || draft.plan.areas.length > 0) && <Button variant="danger" onClick={() => setConfirmClear(true)}>Clear area plan</Button>}
    {confirmClear && <Sheet title="Clear area plan?" onClose={() => setConfirmClear(false)}>
      <div className="space-y-4">
        <p className="text-sm">Remove all planting areas and mulch layers from {bed.name}? You can use Undo to restore them while this editor stays open.</p>
        <Button variant="danger" onClick={() => { editor.clearPlan(); setConfirmClear(false); }}>Clear all areas</Button>
        <Button variant="secondary" onClick={() => setConfirmClear(false)}>Keep areas</Button>
      </div>
    </Sheet>}
  </details>;
}
