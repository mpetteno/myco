import type { MulchArea } from './mulchPlan';
import type { MulchLayerPreview } from './mulchRendering';
import { visibleMulchLayer } from './mulchRendering';

export function MulchCanvasInfo({ area, preview }: { area?: MulchArea; preview: MulchLayerPreview }) {
  const layer = area && visibleMulchLayer(area, preview);
  return <header className="flex h-12 shrink-0 flex-col justify-center border-b border-stone-200 bg-white px-4 text-sm dark:border-stone-800 dark:bg-stone-900">
    <div className="flex min-w-0 items-center gap-3">
      <p className="min-w-0 flex-1 truncate">{area?.name ?? 'Select a mulch area'}</p>
      {area && <p className="shrink-0 text-xs text-stone-600 dark:text-stone-400">{area.widthCm} × {area.lengthCm} cm</p>}
    </div>
    <p className="h-4 truncate text-xs text-stone-600 dark:text-stone-400">{layer ? `${layer.material.name} · ${preview?.areaId === area?.id ? 'Layer preview' : 'Top layer'} · 5 cm clearance around plants` : 'Use Mulch controls to add an area and its layers'}</p>
  </header>;
}
