import { plantLabel } from './plantingPlan';
import type { PlantingArea } from './plantingPlan';
import type { AreaMeasurement } from './areaMeasurements';

export function AreaCanvasInfo({ area, index, measurements, label }: { area?: PlantingArea; index: number; measurements: AreaMeasurement[]; label?: string }) {
  const name = label ?? (area ? plantLabel(area.plant) : undefined);
  const tight = measurements.filter((item) => item.kind === 'row-gap' && item.warning);
  return <header className="flex h-12 shrink-0 flex-col justify-center border-b border-stone-200 bg-white px-4 text-sm dark:border-stone-800 dark:bg-stone-900">
    <div className="flex min-w-0 items-center gap-3">
      <p className="min-w-0 flex-1 truncate" title={area ? `Area ${index + 1}: ${name}` : undefined}>{area ? `Area ${index + 1} · ${name}` : 'Select an area to see its measurements'}</p>
      {area && <p className="shrink-0 text-xs text-stone-600 dark:text-stone-400">{area.widthCm} × {area.lengthCm} cm</p>}
    </div>
    <p className={`h-4 truncate text-xs ${tight.length ? 'text-red-700 dark:text-red-400' : 'text-stone-600 dark:text-stone-400'}`}>
      {tight.length && area ? `! Rows are closer than the catalogue recommendation (${area.plant.rowSpacingCm} cm).` : ''}
    </p>
  </header>;
}
