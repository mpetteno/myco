import { Button } from '../../shared/ui/Button';

export type BedEditorTool = 'area' | 'bed' | 'recap' | 'catalogue' | 'mulch' | 'mulch-catalogue';
type BedEditorToolbarProps = { tool: BedEditorTool; canAdd: boolean;
  onAdd: () => void; onTool: (tool: BedEditorTool) => void; disabled: boolean; onHistory?: () => void };

export function BedEditorToolbar({ tool, canAdd, onAdd, onTool, disabled, onHistory }: BedEditorToolbarProps) {
  return <footer className="shrink-0 border-t border-stone-200 bg-white px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 dark:border-stone-800 dark:bg-stone-900">
    <div className="mx-auto grid max-w-7xl grid-cols-3 gap-1 [&_button]:h-full [&_button]:px-1 [&_button]:text-xs sm:flex sm:gap-2 sm:[&_button]:px-3 sm:[&_button]:text-sm">
      <div className="min-w-0 flex-1"><Button disabled={disabled || !canAdd} onClick={onAdd}>Add area</Button></div>
      {([['area', 'Areas'], ['mulch', 'Mulch'], ['bed', 'Bed'], ['recap', 'Recap']] as const).map(([value, label]) => <div key={value} className="min-w-0 flex-1">
        <Button variant="secondary" disabled={disabled} aria-pressed={tool === value} onClick={() => onTool(value)}>{label}</Button>
      </div>)}
      {onHistory && <div className="min-w-0 flex-1"><Button variant="secondary" disabled={disabled} onClick={onHistory}>History</Button></div>}
    </div>
  </footer>;
}
