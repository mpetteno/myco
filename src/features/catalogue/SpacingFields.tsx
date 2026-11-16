import { NumberField } from '../../shared/ui/NumberField';

type SpacingFieldsProps = { plant: string; row: string; onPlant: (value: string) => void;
  onRow: (value: string) => void; disabled: boolean; inherits: boolean };

export function SpacingFields({ plant, row, onPlant, onRow, disabled, inherits }: SpacingFieldsProps) {
  return <fieldset disabled={disabled} className="space-y-3">
    <legend className="mb-2 text-sm font-medium">Recommended spacing</legend>
    <NumberField id="catalogue-plant-spacing" label="Between plants in a row" min={0} step="any"
      value={plant} onChange={(event) => onPlant(event.target.value)} />
    <NumberField id="catalogue-row-spacing" label="Between rows" min={0} step="any"
      value={row} onChange={(event) => onRow(event.target.value)} />
    <p className="text-xs text-stone-600 dark:text-stone-400">{inherits
      ? 'Leave a distance empty to use its family default. Planning will allow exceptions.'
      : 'Optional defaults for this family. Individual plant types can override them.'}</p>
  </fieldset>;
}
