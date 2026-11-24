import type { CameraCommand } from './planCamera';

export const canvasButtonStyle = 'min-h-11 min-w-11 cursor-pointer rounded-lg px-2 text-sm font-medium hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-green-600 disabled:cursor-default disabled:opacity-35 aria-pressed:bg-green-50 aria-pressed:text-green-900 aria-pressed:ring-1 aria-pressed:ring-green-700 dark:hover:bg-stone-800 dark:aria-pressed:bg-green-950 dark:aria-pressed:text-green-200 dark:aria-pressed:ring-green-400';

type Props = { scope: 'Bed' | 'Garden'; selected: boolean; panning: boolean; disabled: boolean;
  onCamera: (action: CameraCommand['action']) => void; onPan: () => void };

export function CanvasNavigation({ scope, selected, panning, disabled, onCamera, onPan }: Props) {
  const target = scope === 'Garden' ? 'bed' : 'area';
  return <nav aria-label={`${scope} view`} className="flex h-12 shrink-0 items-center justify-center gap-1">
    <button type="button" className={canvasButtonStyle} aria-label="Zoom out" disabled={disabled} onClick={() => onCamera('zoom-out')}>−</button>
    <button type="button" className={canvasButtonStyle} aria-label="Zoom in" disabled={disabled} onClick={() => onCamera('zoom-in')}>+</button>
    <button type="button" className={canvasButtonStyle} disabled={disabled} onClick={() => onCamera('fit')}>Fit {scope.toLowerCase()}</button>
    <button type="button" className={canvasButtonStyle} disabled={disabled || !selected} onClick={() => onCamera('focus')}>Focus {target}</button>
    <button type="button" className={canvasButtonStyle} aria-label="Pan view" aria-pressed={panning} disabled={disabled} onClick={onPan}>Pan</button>
  </nav>;
}
