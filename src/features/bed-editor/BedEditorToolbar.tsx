import { Button } from '../../shared/ui/Button';

export type BedEditorTool = 'area' | 'bed' | 'recap';
type BedEditorToolbarProps = { tool: BedEditorTool; canAdd: boolean; controlsOpen: boolean;
  onAdd: () => void; onTool: (tool: BedEditorTool) => void; disabled: boolean; onHistory?: () => void };

export function BedEditorToolbar({ tool, canAdd, controlsOpen, onAdd, onTool, disabled, onHistory }: BedEditorToolbarProps) {
  return <footer className="shrink-0 border-t border-stone-200 bg-white px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 dark:border-stone-800 dark:bg-stone-900">
    <nav aria-label="Bed tools" className={`mx-auto grid max-w-7xl ${onHistory ? 'grid-cols-5' : 'grid-cols-4'} gap-1 [&_button]:h-full [&_button]:px-1 [&_button]:text-xs lg:flex lg:gap-2 lg:[&_button]:px-3 lg:[&_button]:text-sm`}>
      <div className="min-w-0 flex-1"><Button disabled={disabled || !canAdd} onClick={onAdd}>Add area</Button></div>
      {([['area', 'Areas'], ['recap', 'Summary'], ['bed', 'Settings']] as const).map(([value, label]) => <div key={value} className="min-w-0 flex-1">
        <Button id={`bed-tool-${value}`} variant="secondary" disabled={disabled} aria-pressed={controlsOpen && tool === value} aria-controls="bed-inspector"
          aria-expanded={controlsOpen && tool === value} onClick={() => onTool(value)}>{label}</Button>
      </div>)}
      {onHistory && <div className="min-w-0 flex-1"><Button variant="secondary" disabled={disabled} onClick={onHistory}>History</Button></div>}
    </nav>
  </footer>;
}
