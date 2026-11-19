import { Button } from '../../shared/ui/Button';
import type { GardenPanel } from './GardenPanels';
import type { GardenDimensions } from './garden';

type GardenToolbarProps = {
  dimensions: GardenDimensions | null; hasSelection: boolean; bedCount: number;
  onOpen: (panel: GardenPanel) => void; onEditBed: () => void; onHistory?: () => void;
  bedScope?: boolean; readOnly?: boolean; disabled?: boolean;
  selectedBedName?: string; canUndo?: boolean; onUndo?: () => void;
};

export function GardenToolbar({ dimensions, hasSelection, bedCount, onOpen, onEditBed, bedScope = false, readOnly = false, disabled = false, selectedBedName }: GardenToolbarProps) {
  const hasGarden = !!dimensions;
  return <footer inert={disabled} className="shrink-0 border-t border-stone-200 bg-white px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 dark:border-stone-800 dark:bg-stone-900">
    <div className="mx-auto max-w-7xl">
      <nav aria-label="Garden tools" className="grid grid-cols-4 gap-1 [&_button]:h-full [&_button]:px-1 [&_button]:text-xs sm:flex sm:gap-2 sm:[&_button]:px-3 sm:[&_button]:text-sm">
        <div className="min-w-0 flex-1"><Button disabled={!hasGarden || readOnly || bedScope} onClick={() => onOpen('add')}>Add bed</Button></div>
        <div className="min-w-0 flex-1"><Button variant="secondary" disabled={!hasGarden} onClick={() => onOpen('beds')}>Beds ({bedCount})</Button></div>
        <div className="min-w-0 flex-1">{hasSelection && !readOnly
          ? <Button variant="secondary" title={selectedBedName ? `Edit ${selectedBedName}` : undefined} onClick={onEditBed}>Edit bed</Button>
          : <Button variant="secondary" disabled={!hasGarden} onClick={() => onOpen('recap')}>Summary</Button>}</div>
        <div className="min-w-0 flex-1"><Button variant="secondary" onClick={() => onOpen('actions')}>More</Button></div>
      </nav>
    </div>
  </footer>;
}
