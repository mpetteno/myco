import { Button } from '../../shared/ui/Button';
import type { GardenPanel } from './GardenPanels';
import type { GardenDimensions } from './garden';

type GardenToolbarProps = {
  dimensions: GardenDimensions | null; hasSelection: boolean;
  onOpen: (panel: GardenPanel) => void; onEditBed: () => void; onResizeBed: () => void;
  onCalendar?: () => void;
  calendarOpen?: boolean; bedScope?: boolean; readOnly?: boolean; disabled?: boolean;
  resizing?: boolean; selectedBedName?: string;
};

export function GardenToolbar({ dimensions, hasSelection, onOpen, onEditBed, onResizeBed, onCalendar, bedScope = false, readOnly = false, disabled = false, resizing = false, selectedBedName, calendarOpen = false }: GardenToolbarProps) {
  const hasGarden = !!dimensions;
  return <footer inert={disabled} className="shrink-0 border-t border-stone-200 bg-white px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 dark:border-stone-800 dark:bg-stone-900">
    <div className="mx-auto max-w-7xl">
      <nav aria-label="Garden tools" className={`grid ${hasSelection ? onCalendar ? 'grid-cols-5' : 'grid-cols-4' : onCalendar ? 'grid-cols-4' : 'grid-cols-3'} gap-1 [&_button]:h-full [&_button]:px-1 [&_button]:text-xs sm:flex sm:gap-2 sm:[&_button]:px-3 sm:[&_button]:text-sm`}>
        {hasSelection ? <>
          <div className="min-w-0 flex-1"><Button disabled={readOnly} title={selectedBedName ? `Edit ${selectedBedName}` : undefined} onClick={onEditBed}>Edit bed</Button></div>
          <div className="min-w-0 flex-1"><Button variant="secondary" disabled={readOnly} aria-pressed={resizing} onClick={onResizeBed}>{resizing ? 'Done resizing' : 'Resize bed'}</Button></div>
          <div className="min-w-0 flex-1"><Button variant="secondary" onClick={() => onOpen('bed-recap')}>Bed summary</Button></div>
        </> : <>
          <div className="min-w-0 flex-1"><Button disabled={!hasGarden || readOnly || bedScope} onClick={() => onOpen('add')}>Add bed</Button></div>
          <div className="min-w-0 flex-1"><Button variant="secondary" disabled={!hasGarden} onClick={() => onOpen('recap')}>Summary</Button></div>
        </>}
        {onCalendar && <div className="min-w-0 flex-1"><Button variant="secondary" onClick={onCalendar} aria-pressed={calendarOpen}>Calendar</Button></div>}
        <div className="min-w-0 flex-1"><Button variant="secondary" aria-label={hasSelection ? 'More bed actions' : 'More garden actions'} onClick={() => onOpen('actions')}>More</Button></div>
      </nav>
    </div>
  </footer>;
}
