import { useMemo } from 'react';
import type { GardenDocument } from '../gardens/gardenDocument';
import { getGardenRecap } from './summarizeGarden';
import { formatArea } from '../../shared/units/area';

export function GardenRecap({ garden, scope = 'garden' }: { garden: GardenDocument; scope?: 'garden' | 'bed' }) {
  const recap = useMemo(() => getGardenRecap(garden.beds), [garden.beds]);
  return <div className="space-y-4 text-sm">
    <p className="text-stone-600 dark:text-stone-400">{scope === 'garden' && `${garden.name} · `}{garden.dimensions.widthCm} × {garden.dimensions.lengthCm} cm</p>
    <dl className="space-y-2 rounded-lg bg-stone-50 p-3 dark:bg-stone-950">
      <div className="flex justify-between gap-3"><dt>{scope === 'bed' ? 'Bed surface' : 'Garden surface'}</dt><dd>{formatArea(garden.dimensions.widthCm * garden.dimensions.lengthCm)}</dd></div>
      {scope === 'garden' && <div className="flex justify-between gap-3"><dt>Beds</dt><dd>{garden.beds.length}</dd></div>}
      <div className="flex justify-between gap-3"><dt>Total plants</dt><dd>{recap.invalidBeds.length ? '—' : recap.totalPlants.toLocaleString()}</dd></div>
      {scope === 'garden' && <div className="flex justify-between gap-3"><dt>Area occupied by beds</dt><dd className="shrink-0">{formatArea(recap.occupiedAreaCm2)}</dd></div>}
    </dl>
    {recap.invalidBeds.length ? <p role="alert" className="text-red-700 dark:text-red-400">
      Plant totals are unavailable. Check the planting plans in: {recap.invalidBeds.join(', ')}.
    </p> : recap.plants.length ? <section aria-label="Garden plants by type" className="space-y-2">
      <h3 className="font-semibold">Plants by type</h3>
      <ul className="space-y-2">{recap.plants.map((plant) => <li key={plant.id} className="flex justify-between gap-3">
        <span className="min-w-0 break-words">{plant.name}</span><span className="shrink-0">{plant.plants.toLocaleString()} plants</span>
      </li>)}</ul>
    </section> : recap.sowings.length ? null : <p className="text-stone-600 dark:text-stone-400">{garden.beds.length ? 'No plant rows or broadcast sowing in these beds yet.' : 'No beds yet. Use Add bed to start your garden.'}</p>}
    {recap.sowings.length > 0 && <section aria-label="Broadcast seed quantities" className="space-y-2"><h3 className="font-semibold">Broadcast seed quantities</h3>
      <ul className="space-y-2">{recap.sowings.map((sowing) => <li key={sowing.id}><span className="font-medium">{sowing.name}</span> · {Number(sowing.quantity.toFixed(4))} {sowing.unit}
        {(scope === 'garden' || sowing.greenManure) && <span className="block text-xs text-stone-600 dark:text-stone-400">{scope === 'garden' && sowing.bedName}{sowing.greenManure ? scope === 'garden' ? ' · Green manure' : 'Green manure' : ''}</span>}
      </li>)}</ul>
    </section>}
  </div>;
}
