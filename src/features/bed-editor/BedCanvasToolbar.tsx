import type { CameraCommand } from '../plan-camera/planCamera';
import { CanvasNavigation, canvasButtonStyle } from '../plan-camera/CanvasNavigation';

type Props = { selected: boolean; resizing: boolean; panning: boolean; disabled: boolean;
  onCamera: (action: CameraCommand['action']) => void; onPan: () => void; onResize: () => void; onEdit: () => void };

export function BedCanvasToolbar({ selected, resizing, panning, disabled, onCamera, onPan, onResize, onEdit }: Props) {
  const style = canvasButtonStyle;
  return <div className="shrink-0 border-t border-stone-200 bg-white px-2 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] dark:border-stone-800 dark:bg-stone-900">
    <div className="lg:col-start-2"><CanvasNavigation scope="Bed" selected={selected} panning={panning} disabled={disabled} onCamera={onCamera} onPan={onPan} /></div>
    <div className="flex h-12 items-center justify-center gap-2 border-t border-stone-100 lg:col-start-3 lg:row-start-1 lg:justify-end lg:border-t-0 dark:border-stone-800">
      <button type="button" className={style} aria-pressed={resizing} disabled={disabled || !selected} onClick={onResize}>{resizing ? 'Done resizing' : 'Resize area'}</button>
      <button type="button" className={`${style} lg:hidden`} disabled={disabled || !selected} onClick={onEdit}>Edit selected area</button>
      <span className="hidden text-xs text-stone-500 sm:inline lg:hidden">{panning ? 'Drag to pan · Wheel or pinch to zoom' : 'Drag areas to move · Wheel or pinch to zoom'}</span>
    </div>
  </div>;
}
