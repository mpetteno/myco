import type { Bed } from '../beds/bed';
import { PlantingSummary } from '../planting/PlantingSummary';
import type { useBedEditor } from './useBedEditor';
import { formatArea } from '../../shared/units/area';

export function BedRecap({ bed, editor }: { bed: Bed; editor: ReturnType<typeof useBedEditor> }) {
  const { draft, preview, advice, mulch } = editor;
  const surface = bed.widthCm * bed.lengthCm;
  const assigned = draft.plan.areas.reduce((total, area) => total + area.widthCm * area.lengthCm, 0);
  const totals = new Map<string, { name: string; plants: number; areas: number }>();
  draft.plan.areas.forEach((area, index) => {
    const total = totals.get(area.plant.id) ?? { name: area.plant.name, plants: 0, areas: 0 };
    total.plants += preview.counts[index]?.plants ?? 0; total.areas++;
    totals.set(area.plant.id, total);
  });
  return <div className="space-y-4 text-sm">
    <p className="font-medium">{bed.name} · {bed.widthCm} × {bed.lengthCm} cm</p>
    <dl className="space-y-2 rounded-lg bg-stone-50 p-3 dark:bg-stone-950">
      <div className="flex justify-between gap-3"><dt>Bed surface</dt><dd>{formatArea(surface)}</dd></div>
      <div className="flex justify-between gap-3"><dt>Planting areas</dt><dd>{draft.plan.areas.length}</dd></div>
      <div className="flex justify-between gap-3"><dt>Assigned to planting areas</dt><dd>{formatArea(assigned)}</dd></div>
      <div className="flex justify-between gap-3"><dt>Outside planting areas</dt><dd>{formatArea(Math.max(0, surface - assigned))}</dd></div>
    </dl>
    {!draft.plan.areas.length ? <p className="text-stone-600 dark:text-stone-400">No planting areas yet. Use Add area to start planning plants.</p>
      : preview.error ? <p role="alert" className="text-red-700 dark:text-red-400">Plant counts are unavailable until the highlighted planting fields are fixed.</p> : <>
        <section aria-label="Plants by type" className="space-y-2">
          <h3 className="font-semibold">Plants by type</h3>
          <ul className="space-y-2">{[...totals.entries()].sort(([, first], [, second]) => first.name.localeCompare(second.name)).map(([id, total]) =>
            <li key={id} className="flex justify-between gap-3"><span className="min-w-0 break-words">{total.name}</span>
              <span className="shrink-0">{total.plants} plants · {total.areas} {total.areas === 1 ? 'area' : 'areas'}</span></li>)}</ul>
        </section>
        <section aria-label="Planting area recap" className="space-y-2">
          <h3 className="font-semibold">Planting areas</h3>
          <PlantingSummary plan={draft.plan} preview={preview} advice={advice} />
        </section>
      </>}
    <p className="text-stone-600 dark:text-stone-400">Mulch: {mulch.plan.areas.length} areas · {mulch.plan.areas.reduce((total, area) => total + area.layers.length, 0)} layers.</p>
  </div>;
}
