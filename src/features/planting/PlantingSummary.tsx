import { useDarkMode } from '../../shared/hooks/useDarkMode';
import type { BedPlantingPlan, PlantingAdvice } from './plantingPlan';
import type { PlantingPreview } from './plantingGeometry';
import { areaColor } from './PlantingMarks';
import { formatArea } from '../../shared/units/area';

export function PlantingSummary({ plan, preview, advice }: { plan: BedPlantingPlan; preview: PlantingPreview; advice: PlantingAdvice[] }) {
  const dark = useDarkMode();
  return <div className="space-y-3 text-sm">
    <p role="status" className="font-semibold">{preview.points.length} plants · {preview.counts.reduce((sum, count) => sum + count.rows, 0)} rows</p>
    <ul className="space-y-1">
      {plan.areas.map((area, index) => <li key={area.id} className="flex items-start gap-2">
        <span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-full border border-stone-500" style={{ backgroundColor: areaColor(index, dark) }} />
        <span className="min-w-0 break-words">Area {index + 1}: {area.plant.name} · {preview.counts[index]?.plants ?? 0} plants in {preview.counts[index]?.rows ?? 0} rows{preview.counts[index]?.emptyRows ? ` (${preview.counts[index].emptyRows} empty)` : ''}
          <span className="block text-xs text-stone-600 dark:text-stone-400">{area.widthCm} × {area.lengthCm} cm · {formatArea(area.widthCm * area.lengthCm)}</span>
        </span>
      </li>)}
    </ul>
    {preview.counts.some((count) => count.emptyRows) && <p className="text-amber-800 dark:text-amber-400">Some rows are empty after spacing checks against earlier areas. Adjust the areas or override cross-area spacing to fill them.</p>}
    {!plan.respectAreaSpacing && <p className="text-amber-800 dark:text-amber-400">Spacing checks between different areas are overridden. Plants near their boundaries may be closer than recommended.</p>}
    {advice.filter((item) => item.relationship !== 'unknown').map((item) => {
      const first = plan.areas.find((area) => area.id === item.firstAreaId)!, second = plan.areas.find((area) => area.id === item.secondAreaId)!;
      return <p key={`${item.firstAreaId}:${item.secondAreaId}`} className={item.relationship === 'caution' ? 'text-amber-800 dark:text-amber-400' : 'text-green-800 dark:text-green-400'}>
        {item.relationship === 'caution' ? 'Caution' : 'Companion suggestion'}: {first.plant.name} + {second.plant.name}.{item.notes && ` ${item.notes}`}
      </p>;
    })}
    {advice.some((item) => item.relationship === 'unknown') && <p className="text-xs text-stone-600 dark:text-stone-400">Some combinations have no companion information. Missing information is treated as unknown.</p>}
  </div>;
}
