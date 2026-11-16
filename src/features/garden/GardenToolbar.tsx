import { Button } from '../../shared/ui/Button';
import type { GardenPanel } from './GardenPanels';
import type { GardenDimensions } from './garden';

type GardenToolbarProps = {
  dimensions: GardenDimensions | null;
  hasSelection: boolean;
  bedCount: number;
  onOpen: (panel: GardenPanel) => void;
};

export function GardenToolbar({ dimensions, hasSelection, bedCount, onOpen }: GardenToolbarProps) {
  const hasGarden = !!dimensions;
  return (
    <footer className="shrink-0 border-t border-stone-200 bg-white px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="mx-auto max-w-7xl">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1"><Button disabled={!hasGarden} onClick={() => onOpen('add')}>Add bed</Button></div>
          <div className="min-w-0 flex-1"><Button variant="secondary" disabled={!hasGarden} onClick={() => onOpen('beds')}>Beds ({bedCount})</Button></div>
          <div className="min-w-0 flex-1"><Button variant="secondary" disabled={!hasSelection} onClick={() => onOpen('edit')}>Edit bed</Button></div>
          <div className="min-w-0 flex-1"><Button variant="secondary" onClick={() => onOpen('actions')}>More</Button></div>
        </div>
      </div>
    </footer>
  );
}
