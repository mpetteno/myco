import { Button } from '../../shared/ui/Button';

export type BedEditorTool = 'area' | 'bed' | 'recap' | 'suggestions';
type BedEditorToolbarProps = { tool: BedEditorTool; canAdd: boolean; controlsOpen: boolean;
  onAdd: () => void; onTool: (tool: BedEditorTool) => void; disabled: boolean; readOnly?: boolean; calendarOpen?: boolean; onCalendar?: () => void };

export function BedEditorToolbar({ tool, canAdd, controlsOpen, onAdd, onTool, disabled, onCalendar, readOnly = false, calendarOpen = false }: BedEditorToolbarProps) {
  return <footer className="shrink-0 border-t border-stone-200 bg-white px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 dark:border-stone-800 dark:bg-stone-900">
    <nav aria-label="Bed tools" className={`mx-auto grid max-w-7xl ${onCalendar ? 'grid-cols-6' : 'grid-cols-5'} gap-1 [&_button]:h-full [&_button]:px-0.5 [&_button]:text-[11px] sm:[&_button]:text-xs lg:flex lg:gap-2 lg:[&_button]:px-3 lg:[&_button]:text-sm`}>
      <div className="min-w-0 flex-1"><Button disabled={disabled || readOnly || !canAdd} onClick={onAdd}>Add area</Button></div>
      {([['area', 'Areas'], ['recap', 'Summary'], ['suggestions', 'Advice'], ['bed', 'Settings']] as const).map(([value, label]) => <div key={value} className="min-w-0 flex-1">
        <Button id={`bed-tool-${value}`} aria-label={value === 'suggestions' ? 'Suggestions' : label} variant="secondary" disabled={disabled || readOnly} aria-pressed={controlsOpen && !calendarOpen && tool === value} aria-controls="bed-inspector"
          aria-expanded={controlsOpen && !calendarOpen && tool === value} onClick={() => onTool(value)}>{value === 'recap' || value === 'bed' ? <><span className="sm:hidden">{value === 'recap' ? 'Recap' : 'Bed'}</span><span className="hidden sm:inline">{label}</span></> : label}</Button>
      </div>)}
      {onCalendar && <div className="min-w-0 flex-1"><Button variant="secondary" disabled={disabled} aria-pressed={calendarOpen} onClick={onCalendar}>Calendar</Button></div>}
    </nav>
  </footer>;
}
