import { Button } from '../../shared/ui/Button';
import { NumberField } from '../../shared/ui/NumberField';
import { SelectField } from '../../shared/ui/SelectField';
import { TextField } from '../../shared/ui/TextField';
import type { Catalogue } from '../catalogue/catalogue';
import type { BedPlantingPlan, PlantingArea, RowDirection } from './plantingPlan';
import { gridSpacingCm } from './plantingGeometry';
import { areaRowLayout } from './areaRowLayout';
import type { GardenDimensions } from '../garden/garden';
import { planAreaMargins } from './spacingMargins';
import { DEFAULT_AREA_ROWS } from './plantingPlan';

type PlantingAreaFieldsProps = { area: PlantingArea; plan: BedPlantingPlan; bed: GardenDimensions; catalogue: Catalogue;
  onPlant: (id: string) => void; onChange: (values: Partial<PlantingArea>) => void };

export function PlantingAreaFields({ area, plan, bed, catalogue, onPlant, onChange }: PlantingAreaFieldsProps) {
  const reference = (value: number | null) => value === null ? 'not set' : `${value} cm`;
  const manualRows = area.rowCount != null;
  const layout = area.plantSpacingCm > 0 && area.rowSpacingCm > 0 ? areaRowLayout(plan, area, bed) : null;
  const actualRowSpacing = manualRows && area.rowCount! > 1 ? layout?.rowStep : area.rowSpacingCm;
  const changed = area.plantSpacingCm !== area.plant.plantSpacingCm || actualRowSpacing !== area.plant.rowSpacingCm;
  const margins = planAreaMargins(plan, area);
  return <fieldset className="space-y-3 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
    <legend className="px-1 text-sm font-medium">Selected area · {area.widthCm} × {area.lengthCm} cm</legend>
    <SelectField id="planting-type" label="Plant type" value={area.plant.id} onChange={(event) => onPlant(event.target.value)}>
      {!catalogue.plants.some((plant) => plant.id === area.plant.id) && <option value={area.plant.id}>{area.plant.name} (saved reference)</option>}
      {catalogue.plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name} · {catalogue.families.find((family) => family.id === plant.familyId)?.name}</option>)}
    </SelectField>
    <p className="text-xs text-stone-600 dark:text-stone-400">Saved reference: {reference(area.plant.plantSpacingCm)} between plants; {reference(area.plant.rowSpacingCm)} between rows.</p>
    <p className="text-xs text-stone-600 dark:text-stone-400">Minimum clearances: {margins.acrossCm} cm at row sides and {margins.alongCm} cm at row ends. Rows keep their spacing and share the remaining border space. When space is tight, row gaps shrink to preserve these minima.</p>
    <SelectField id="planting-area-direction" label="Rows run" value={area.rowDirection} onChange={(event) => onChange({ rowDirection: event.target.value as RowDirection })}>
      <option value="length">Along bed length</option>
      <option value="width">Along bed width</option>
    </SelectField>
    <div className="flex items-end gap-2"><div className="min-w-0 flex-1"><TextField id="planting-row-count" label="Number of rows" type="number" inputMode="numeric" min={1} max={20000} step={1}
      placeholder="Automatic" value={area.rowCount ?? ''} onChange={(event) => {
        const rowCount = event.target.value === '' ? null : Number(event.target.value);
        onChange({ rowCount, ...(rowCount !== null && !(area.rowSpacingCm > 0) ? { rowSpacingCm: area.plant.rowSpacingCm ?? 5 } : {}) });
      }} /></div><div className="shrink-0"><Button type="button" variant="secondary" aria-label="Reset number of rows" title={`Reset to ${DEFAULT_AREA_ROWS} rows`}
        onClick={() => onChange({ rowCount: DEFAULT_AREA_ROWS })}>Reset</Button></div></div>
    <div className="flex items-end gap-2"><div className="min-w-0 flex-1"><NumberField id="planting-plant-spacing" label="Between plants in a row" min={0} step="any" required
      value={area.plantSpacingCm > 0 ? area.plantSpacingCm : ''} onChange={(event) => onChange({ plantSpacingCm: Number(event.target.value) })} /></div>
      <div className="shrink-0"><Button type="button" variant="secondary" aria-label="Reset plant spacing" title="Restore the saved catalogue spacing" disabled={area.plant.plantSpacingCm === null}
        onClick={() => onChange({ plantSpacingCm: area.plant.plantSpacingCm! })}>Reset</Button></div></div>
    {!manualRows && <NumberField id="planting-row-spacing" label="Between rows" min={0} step="any" required
      value={area.rowSpacingCm > 0 ? area.rowSpacingCm : ''} onChange={(event) => onChange({ rowSpacingCm: Number(event.target.value) })} />}
    {layout && !layout.error && <p className="text-xs text-stone-600 dark:text-stone-400">Grid spacing: {gridSpacingCm(area.plantSpacingCm)} cm between plants. {manualRows && area.rowCount === 1
      ? 'One row is centred in the area.' : `Between rows: ${layout.rowStep === layout.maxRowStep ? layout.rowStep : `${layout.rowStep}–${layout.maxRowStep}`} cm.`}</p>}
    {manualRows && <p className="text-xs text-stone-600 dark:text-stone-400">Your chosen rows are centred at {gridSpacingCm(area.rowSpacingCm)} cm spacing when it fits. Compressed gaps and opposite borders may differ by 5 cm to stay on the grid. Clear the count to set row spacing directly.</p>}
    {layout && !layout.error && layout.rows > 1 && area.plant.rowSpacingCm !== null && layout.rowStep < area.plant.rowSpacingCm && <p role="status" className="text-sm text-red-700 dark:text-red-400">! Row gaps reach {layout.rowStep} cm; the catalogue recommends {area.plant.rowSpacingCm} cm. Red measurements and row guides mark this override.</p>}
    {changed && <p className="text-sm text-amber-800 dark:text-amber-400">Custom spacing overrides the saved recommendation for this area.</p>}
  </fieldset>;
}
