import { plantSelectionKey, plantLabel } from '../planting/plantingPlan';
import type { Bed } from '../beds/bed';
import { PlantingSummary } from '../planting/PlantingSummary';
import type { useBedEditor } from './useBedEditor';
import { formatArea } from '../../shared/units/area';
import { areaLabel, seedLabel, sowingQuantity } from '../area-editor/areaPlan';

export function BedRecap({ bed, editor }: { bed: Bed; editor: ReturnType<typeof useBedEditor> }) {
  const { draft, rows, preview, advice } = editor;
  const surface = bed.widthCm * bed.lengthCm, assigned = draft.plan.areas.reduce((total, area) => total + area.widthCm * area.lengthCm, 0);
  const totals = new Map<string, { name: string; plants: number; areas: number }>();
  rows.areas.forEach((area, index) => {
    const key = plantSelectionKey(area.plant), total = totals.get(key) ?? { name: plantLabel(area.plant), plants: 0, areas: 0 };
    total.plants += preview.counts[index]?.plants ?? 0; total.areas++; totals.set(key, total);
  });
  return <div className="space-y-4 text-sm">
    <p className="font-medium">{bed.name} · {bed.widthCm} × {bed.lengthCm} cm</p>
    <dl className="space-y-2 rounded-lg bg-stone-50 p-3 dark:bg-stone-950">
      <div className="flex justify-between gap-3"><dt>Bed surface</dt><dd>{formatArea(surface)}</dd></div>
      <div className="flex justify-between gap-3"><dt>Areas</dt><dd>{draft.plan.areas.length}</dd></div>
      <div className="flex justify-between gap-3"><dt>Assigned to areas</dt><dd>{formatArea(assigned)}</dd></div>
      <div className="flex justify-between gap-3"><dt>Outside areas</dt><dd>{formatArea(Math.max(0, surface - assigned))}</dd></div>
    </dl>
    {!draft.plan.areas.length && <p>No areas yet. Use Add area to start planning.</p>}
    {editor.validation && <p role="alert" className="text-red-700 dark:text-red-400">Area quantities are unavailable until the highlighted fields are fixed.</p>}
    {!editor.validation && rows.areas.length > 0 && <>
      <section aria-label="Plants by type" className="space-y-2"><h3 className="font-semibold">Plants by type</h3>
        <ul className="space-y-2">{[...totals.entries()].sort(([, a], [, b]) => a.name.localeCompare(b.name)).map(([id, total]) => <li key={id} className="flex justify-between gap-3"><span>{total.name}</span><span>{total.plants} plants · {total.areas} {total.areas === 1 ? 'area' : 'areas'}</span></li>)}</ul>
      </section>
      <section aria-label="Planting area recap" className="space-y-2"><h3 className="font-semibold">Plant rows</h3><PlantingSummary plan={rows} preview={preview} advice={advice} showLegacySpacingWarnings={false} /></section>
    </>}
    {draft.plan.areas.filter((area) => area.kind !== 'rows' || area.purpose === 'green_manure').map((area) => <div key={area.id} className="space-y-1 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
      <p className="font-medium">{areaLabel(area)} · {formatArea(area.widthCm * area.lengthCm)}</p>
      <p>{area.purpose === 'green_manure' ? 'Green manure' : 'Harvest crop'} · {area.kind === 'broadcast' ? 'Broadcast sowing' : area.kind === 'unplanted' ? 'Unplanted' : 'Plant rows'}</p>
      {area.kind === 'broadcast' && !editor.validation && <p>{seedLabel(area.sowing)} · {area.density} g/m² · Total seed required: {Number(sowingQuantity(area).total.toFixed(4))} g</p>}
    </div>)}
    <p className="text-stone-600 dark:text-stone-400">Mulch: {draft.plan.areas.filter((area) => area.mulch.length).length} areas · {draft.plan.areas.reduce((total, area) => total + area.mulch.length, 0)} layers.</p>
  </div>;
}
