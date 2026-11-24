import { Button } from '../../shared/ui/Button';
import { NumberField } from '../../shared/ui/NumberField';
import { useScopedId } from '../../shared/ui/FieldScope';
import { actualClearances, getAreaMeasurements } from './areaMeasurements';
import { clearanceSides, cropMinimumClearance, effectiveClearances, validateClearances } from './plantClearances';
import type { GardenDimensions } from '../garden/garden';
import type { BedPlantingPlan, PlantingArea } from './plantingPlan';

export function PlantClearanceFields({ area, plan, bed, onChange }: { area: PlantingArea; plan: BedPlantingPlan; bed: GardenDimensions; onChange: (values: Partial<PlantingArea>) => void }) {
  const minimum = cropMinimumClearance(area), values = effectiveClearances(area);
  const prefix = useScopedId('plant-clearance');
  const invalid = validateClearances(area, plan.version);
  const actual = actualClearances(invalid ? [] : getAreaMeasurements(plan, area, bed), area);
  return <details className="space-y-3 border-t border-stone-200 pt-3 dark:border-stone-700">
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Plant clearances</summary>
    <p className="text-sm text-stone-600 dark:text-stone-400">Minimum gaps from area edges to plant centres. Actual gaps may be larger.</p>
    <p className="text-xs text-stone-600 dark:text-stone-400">Saved crop minimum: {minimum} cm · Edges follow the bed axes.</p>
    <div className="grid grid-cols-2 gap-3">{clearanceSides.map((side) => <div key={side} className="space-y-1">
      <NumberField id={`plant-clearance-${side}`} label={side[0].toUpperCase() + side.slice(1)} min={minimum} step={5} required
        value={values[side] || ''} aria-describedby={`${prefix}-${side}-actual`} aria-invalid={!Number.isSafeInteger(values[side]) || values[side] < minimum || values[side] % 5 !== 0}
        onChange={(event) => onChange({ clearancesCm: { ...area.clearancesCm, [side]: Number(event.target.value) } })} />
      <p id={`${prefix}-${side}-actual`} className="text-xs text-stone-600 dark:text-stone-400">Actual: {actual[side] === undefined ? '—' : `${actual[side]} cm`}</p>
    </div>)}</div>
    <Button variant="secondary" disabled={area.clearancesCm === undefined} onClick={() => onChange({ clearancesCm: undefined })}>Reset clearances</Button>
  </details>;
}
