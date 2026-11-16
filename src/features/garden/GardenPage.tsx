import type { HistoryEditorOptions } from '../history/historyDraft';
import { HistoryEditPage } from '../history/HistoryEditPage';
import { ThemeToggle } from '../appearance/ThemeToggle';
import { useImperativeHandle, useState } from 'react';
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
import { EditorScreen } from '../../shared/ui/EditorScreen';
import { BedPage } from '../bed-editor/BedPage';
import { useGardenHistory } from '../history/useGardenHistory';
import { GardenHistoryBar } from '../history/GardenHistoryBar';
import { GardenHistoryInspector } from '../history/GardenHistoryInspector';

type GardenPageProps = {
  user: User; garden: SavedGarden; historyDraft?: HistoryEditorOptions; onSaved: (garden: SavedGarden) => void;
  onChooseGardens: () => void; pickerOpen: boolean; onReload: () => Promise<void>;
  onDiscardChanges: () => void;
};

export function GardenPage({ user, garden, onSaved, onChooseGardens, pickerOpen, onReload, onDiscardChanges, historyDraft }: GardenPageProps) {
  const persistence = useGardenPersistence(garden, onSaved, historyDraft ? async (current, document) => ({ ...current, ...document, version: current.version + 1 }) : undefined);
  useImperativeHandle(historyDraft?.bridge, () => ({ beforeLeaving: persistence.beforeLeaving, getCurrent: persistence.getCurrent }));
  const layout = useGardenLayout({ name: garden.name, dimensions: garden.dimensions, beds: garden.beds }, persistence.enqueue);
  const history = useGardenHistory(garden.id, persistence.beforeLeaving, persistence.getCurrent);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(historyDraft?.bedId ?? null);
  const [panel, setPanel] = useState<GardenPanel | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [editingBedId, setEditingBedId] = useState<string | null>(historyDraft?.bedId ?? null);
  const readOnly = !history.current || history.saving;
  const shown = history.current ? layout : history.selected?.document;
  const editingBed = readOnly ? undefined : layout.beds.find((bed) => bed.id === editingBedId);

  function removeBed(id: string) {
    if (readOnly || historyDraft?.bedId) return;
    layout.deleteBed(id);
    setSelectedBedId(null);
    setPanel(null);
    setEditingBedId(null);
  }
  useBedDeletion(selectedBedId, removeBed, !readOnly && !historyDraft?.bedId && panel === null && !pickerOpen && !editingBed);
  const clipboard = useBedClipboard({
    selectedBed: editingBed ?? layout.beds.find((bed) => bed.id === selectedBedId),
    onPaste: (copy) => readOnly ? null : layout.pasteBed(copy), onSelect: setSelectedBedId, enabled: !readOnly && !historyDraft?.bedId && panel === null && !pickerOpen && !editingBed,
  });

  function editBed(id: string) {
    if (readOnly || (historyDraft?.bedId && historyDraft.bedId !== id)) return;
    setSelectedBedId(id); setPanel(null); setEditingBedId(id);
  }

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

  const feedback = <GardenSaveFeedback status={persistence.status} onRetry={persistence.beforeLeaving} onReload={onReload} onDiscardChanges={onDiscardChanges} />;
  if (history.editingHistory) return <HistoryEditPage key={`${history.editingHistory.event?.id ?? 'new'}:${history.editingHistory.event?.eventVersion ?? 0}`} onReload={history.reloadHistoryEdit} draft={history.editingHistory} current={persistence.getCurrent()} user={user} onBack={history.closeHistoryEdit} onSaved={history.historyEdited} />;
  if (editingBed) return <BedPage key={editingBed.id} bed={editingBed} user={user} userId={user.id} status={persistence.status} feedback={feedback}
    historyDraft={!!historyDraft} onValidityChange={historyDraft?.onValidityChange}
    gardenId={garden.id} getCurrent={persistence.getCurrent} onReload={onReload}
    onSaveDetails={(details) => layout.saveBed(details, editingBed.id)} onSavePlan={(plans) => layout.saveBedPlan(editingBed.id, plans)}
    beforeLeaving={persistence.beforeLeaving} onBack={() => setEditingBedId(null)} onDelete={() => removeBed(editingBed.id)}
    onCopy={clipboard.copy} copyMessage={clipboard.feedback.text} />;

  return <EditorScreen feedback={feedback}
    header={<header inert={history.saving} className="flex h-11 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-3 sm:px-4 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex shrink-0 items-center gap-2"><h1 className="text-lg font-semibold tracking-tight text-green-800 dark:text-green-400">Myco</h1><span className="text-xs text-stone-600 dark:text-stone-400">{historyDraft ? 'History draft' : history.current ? 'Plan' : 'History'}</span></div>
          <button type="button" disabled={leaving || !!historyDraft} onClick={() => void chooseGardens()}
            aria-label={historyDraft ? 'Historical garden draft' : `Choose garden. Current garden: ${layout.name}. ${persistence.status.state === 'saved' ? 'All changes saved.' : 'Changes pending.'}`}
            className="mx-2 flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-2 text-sm focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50">
            <span className="truncate">{shown?.name ?? layout.name}</span>{!historyDraft && <span aria-hidden="true">▾</span>}
            {!historyDraft && <span aria-hidden="true" className={persistence.status.state === 'saved' ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>●</span>}
          </button>
          <ThemeToggle />
          {!historyDraft && <button type="button" onClick={() => openPanel('account')} className="min-h-11 cursor-pointer rounded-lg px-3 text-sm font-medium hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:bg-stone-800">Account</button>}
        </header>}
    toolbar={<GardenToolbar dimensions={shown?.dimensions ?? null} bedCount={shown?.beds.length ?? 0}
      readOnly={readOnly} bedScope={!!historyDraft?.bedId} disabled={history.saving} onHistory={historyDraft ? undefined : () => { setPanel(null); void history.show(); }}
      hasSelection={!!selectedBedId && (!historyDraft?.bedId || historyDraft.bedId === selectedBedId)} onOpen={openPanel} onEditBed={() => { if (selectedBedId) editBed(selectedBedId); }} />}>
        <GardenHistoryBar history={history} />
        <div className="flex min-h-0 w-full flex-1 flex-col lg:flex-row">
          <div className="min-h-0 min-w-0 flex-1">
            {shown && (!history.open || history.current || (!history.loading && !history.error)) ? <GardenCanvas key={history.current ? 'current' : history.selected?.id} dimensions={shown.dimensions} beds={shown.beds}
              onMoveBed={(id, position) => { if (!readOnly && (!historyDraft?.bedId || historyDraft.bedId === id)) layout.moveBed(id, position); }}
              onResizeBed={(id, bounds) => { if (!readOnly && (!historyDraft?.bedId || historyDraft.bedId === id)) layout.resizeBed(id, bounds); }}
              selectedBedId={selectedBedId} onSelectBed={setSelectedBedId} readOnly={readOnly}
              onEditBed={editBed} editableBedId={historyDraft?.bedId}
              onSetup={() => { if (!readOnly) openPanel('garden'); }} />
              : <div className="flex h-full items-center justify-center p-6 text-center text-sm text-stone-600 dark:text-stone-400">
                {history.loading ? 'Loading the recorded layout…' : history.error || `No layout was recorded on or before ${history.date}. Choose a later date or return to Plan.`}
              </div>}
          </div>
          <GardenHistoryInspector history={history} onReload={onReload} />
        </div>
        <GardenPanels historyDraft={!!historyDraft} bedScope={historyDraft?.bedId} panel={panel} onPanelChange={setPanel} layout={{ ...layout, ...(shown ?? { beds: [] }) }} user={user} readOnly={readOnly}
          gardenId={garden.id} ownerId={garden.ownerId}
          beforeSignOut={persistence.beforeLeaving} onChooseGardens={() => void chooseGardens()}
          selectedBedId={selectedBedId} clipboard={clipboard} onEditBed={editBed}
          onDelete={() => { if (selectedBedId) removeBed(selectedBedId); }} />
  </EditorScreen>;
}
