import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useBedClipboard } from '../beds/useBedClipboard';
import { useBedDeletion } from '../beds/useBedDeletion';
import { GardenCanvas } from './GardenCanvas';
import { GardenPanels } from './GardenPanels';
import type { GardenPanel } from './GardenPanels';
import { GardenToolbar } from './GardenToolbar';
import { useGardenLayout } from './useGardenLayout';
import type { SavedGarden } from '../gardens/gardenDocument';
import { useGardenPersistence } from '../gardens/useGardenPersistence';
import { GardenSaveFeedback } from '../gardens/GardenSaveFeedback';

type GardenPageProps = {
  user: User; garden: SavedGarden; onSaved: (garden: SavedGarden) => void;
  onChooseGardens: () => void; pickerOpen: boolean; onReload: () => Promise<void>;
  onDiscardChanges: () => void;
};

export function GardenPage({ user, garden, onSaved, onChooseGardens, pickerOpen, onReload, onDiscardChanges }: GardenPageProps) {
  const persistence = useGardenPersistence(garden, onSaved);
  const layout = useGardenLayout({ name: garden.name, dimensions: garden.dimensions, beds: garden.beds }, persistence.enqueue);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<GardenPanel | null>(null);
  const [leaving, setLeaving] = useState(false);

  function removeBed(id: string) {
    layout.deleteBed(id);
    setSelectedBedId(null);
    setPanel(null);
  }
  useBedDeletion(selectedBedId, removeBed, panel === null && !pickerOpen);
  const clipboard = useBedClipboard({
    selectedBed: layout.beds.find((bed) => bed.id === selectedBedId),
    onPaste: layout.pasteBed, onSelect: setSelectedBedId, enabled: panel === null && !pickerOpen,
  });

  function openPanel(next: GardenPanel) {
    if (next === 'add') setSelectedBedId(null);
    setPanel(next);
  }

  async function chooseGardens() {
    if (leaving) return;
    setLeaving(true);
    const error = await persistence.beforeLeaving();
    if (!error) { setPanel(null); onChooseGardens(); }
    setLeaving(false);
  }

  return (
    <main className="h-dvh overflow-hidden bg-stone-50 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] font-sans text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-3 sm:px-4 dark:border-stone-800 dark:bg-stone-900">
          <h1 className="text-lg font-semibold tracking-tight text-green-800 dark:text-green-400">Myco</h1>
          <button type="button" disabled={leaving} onClick={() => void chooseGardens()}
            aria-label={`Choose garden. Current garden: ${layout.name}. ${persistence.status.state === 'saved' ? 'All changes saved.' : 'Changes pending.'}`}
            className="mx-2 flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-2 text-sm focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50">
            <span className="truncate">{layout.name}</span><span aria-hidden="true">▾</span>
            <span aria-hidden="true" className={persistence.status.state === 'saved' ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>●</span>
          </button>
          <button type="button" onClick={() => openPanel('account')} className="min-h-11 cursor-pointer rounded-lg px-3 text-sm font-medium hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:bg-stone-800">Account</button>
        </header>
        <GardenSaveFeedback status={persistence.status} onRetry={persistence.beforeLeaving} onReload={onReload} onDiscardChanges={onDiscardChanges} />
        <div className="min-h-0 w-full flex-1">
          <GardenCanvas dimensions={layout.dimensions} beds={layout.beds} onMoveBed={layout.moveBed}
            onResizeBed={layout.resizeBed} selectedBedId={selectedBedId} onSelectBed={setSelectedBedId}
            onSetup={() => openPanel('garden')} />
        </div>
        <GardenToolbar dimensions={layout.dimensions} bedCount={layout.beds.length}
          hasSelection={!!selectedBedId} onOpen={openPanel} />
        <GardenPanels panel={panel} onPanelChange={setPanel} layout={layout} user={user}
          gardenId={garden.id} ownerId={garden.ownerId}
          beforeSignOut={persistence.beforeLeaving} onChooseGardens={() => void chooseGardens()}
          selectedBedId={selectedBedId} onSelectBed={setSelectedBedId} clipboard={clipboard}
          onDelete={() => { if (selectedBedId) removeBed(selectedBedId); }} />
      </div>
    </main>
  );
}
