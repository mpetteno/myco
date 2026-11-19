import { WorkspaceNav, useWorkspaceNavigation } from '../../shared/navigation/WorkspaceNavigation';
import { useEditorShortcuts } from '../../shared/keyboard/useEditorShortcuts';
import { useAreaClipboard } from '../area-editor/useAreaClipboard';
import { GardenLocationForm } from '../gardens/GardenLocationForm';
import { saveGardenLocation } from '../gardens/gardenRepository';
import { Sheet } from '../../shared/ui/Sheet';
import { useI18n } from '../../shared/i18n/I18nProvider';
import type { HistoryEditorOptions } from '../history/historyDraft';
import { HistoryEditPage } from '../history/HistoryEditPage';
import { ThemeToggle } from '../appearance/ThemeToggle';
import { useImperativeHandle, useState, useEffect } from 'react';
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
import { PlanSaveStatus } from '../bed-editor/PlanSaveStatus';

type GardenPageProps = {
  user: User; garden: SavedGarden; historyDraft?: HistoryEditorOptions; onSaved: (garden: SavedGarden) => void;
  onChooseGardens: () => void; pickerOpen: boolean; onReload: () => Promise<void>;
  onDiscardChanges: () => void;
  onOpenCatalogue?: () => void;
  onEditorContextChange?: (context: 'garden' | 'bed' | 'area') => void;
};

export function GardenPage({ user, garden, onSaved, onChooseGardens, pickerOpen, onReload, onDiscardChanges, historyDraft, onOpenCatalogue, onEditorContextChange }: GardenPageProps) {
  const { t } = useI18n();
  const navigation = useWorkspaceNavigation();
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationSaving, setLocationSaving] = useState(false);
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

  useEffect(() => { if (!editingBed) onEditorContextChange?.('garden'); }, [editingBed, onEditorContextChange]);

  function removeBed(id: string) {
    if (readOnly || historyDraft?.bedId) return;
    layout.deleteBed(id);
    setSelectedBedId(null);
    setPanel(null);
    setEditingBedId(null);
  }
  const shortcutsEnabled = !readOnly && !editingBed && !history.editingHistory && !leaving && !locationOpen
    && !persistence.status.conflict && panel === null && !pickerOpen;
  useBedDeletion(selectedBedId, removeBed, shortcutsEnabled && !historyDraft?.bedId);
  const clipboard = useBedClipboard({
    selectedBed: editingBed ?? layout.beds.find((bed) => bed.id === selectedBedId),
    onPaste: (copy) => readOnly ? null : layout.pasteBed(copy), onSelect: setSelectedBedId,
    enabled: shortcutsEnabled && !historyDraft?.bedId,
  });
  const areaClipboard = useAreaClipboard();
  useEditorShortcuts({ enabled: shortcutsEnabled,
    onUndo: layout.canUndo ? () => { layout.undo(); setSelectedBedId(null); } : undefined,
    onRedo: layout.canRedo ? () => { layout.redo(); setSelectedBedId(null); } : undefined,
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
  async function chooseCatalogue() {
    if (leaving) return;
    setLeaving(true);
    const error = await persistence.beforeLeaving();
    if (!error) { setPanel(null); onOpenCatalogue?.(); }
    setLeaving(false);
  }

  const feedback = <GardenSaveFeedback status={persistence.status} onRetry={persistence.beforeLeaving} onReload={onReload} onDiscardChanges={onDiscardChanges} />;
  if (history.editingHistory) return <HistoryEditPage key={`${history.editingHistory.event?.id ?? 'new'}:${history.editingHistory.event?.eventVersion ?? 0}`} onReload={history.reloadHistoryEdit} draft={history.editingHistory} current={persistence.getCurrent()} user={user} onBack={history.closeHistoryEdit} onSaved={history.historyEdited} />;
  if (editingBed) return <BedPage key={editingBed.id} bed={editingBed} user={user} userId={user.id} status={persistence.status} feedback={feedback}
    onEditorContextChange={onEditorContextChange} historyDraft={!!historyDraft} onValidityChange={historyDraft?.onValidityChange}
    gardenId={garden.id} getCurrent={persistence.getCurrent} onReload={onReload}
    onSaveDetails={(details) => layout.saveBed(details, editingBed.id)} onSavePlan={(plans) => layout.saveBedPlan(editingBed.id, plans)}
    onPosition={(position) => layout.positionBed(editingBed.id, position)}
    beforeLeaving={persistence.beforeLeaving} onBack={() => setEditingBedId(null)} onDelete={() => removeBed(editingBed.id)}
    onCopy={clipboard.copy} copyMessage={clipboard.feedback.text} areaClipboard={areaClipboard} />;

  return <EditorScreen feedback={feedback}
    header={<><header inert={history.saving} className="flex min-h-14 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-3 sm:px-4 dark:border-stone-800 dark:bg-stone-900">
          <h1 className="shrink-0 text-lg font-semibold tracking-tight text-green-800 dark:text-green-400">Myco</h1>
          <button type="button" disabled={leaving || !!historyDraft} onClick={() => void chooseGardens()}
            aria-label={historyDraft ? 'Historical garden draft' : `Choose garden. Current garden: ${layout.name}. ${persistence.status.state === 'saved' ? 'All changes saved.' : 'Changes pending.'}`}
            className="mx-2 flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-2 text-sm focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50">
            <span className="min-w-0 text-left"><span title={shown?.name ?? layout.name} className="block truncate font-medium">{shown?.name ?? layout.name}</span>
              <span className="block truncate text-xs text-stone-600 dark:text-stone-400">{historyDraft ? 'History draft' : !history.current ? 'History · read only' : <PlanSaveStatus status={persistence.status} dirty={false} compact />}</span>
            </span>{!historyDraft && <span aria-hidden="true">▾</span>}
          </button>
          <button type="button" disabled={readOnly || !layout.canUndo || !!persistence.status.conflict} onClick={() => { layout.undo(); setSelectedBedId(null); }}
            className="min-h-11 shrink-0 cursor-pointer rounded-lg px-2 text-sm focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-40">Undo</button>
          <ThemeToggle /><WorkspaceNav />
          {!navigation && !historyDraft && onOpenCatalogue && <button type="button" disabled={leaving} onClick={() => void chooseCatalogue()} className="min-h-11 shrink-0 cursor-pointer rounded-lg px-2 text-sm font-medium hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:bg-stone-800">Catalogue</button>}
        </header>
        {locationOpen && <Sheet title={t('location.title')} dismissible={!locationSaving} onClose={() => setLocationOpen(false)}>
          <p role="alert">{locationError}</p>
          <div inert={locationSaving}><GardenLocationForm initial={persistence.getCurrent().location} onSave={(location) => {
            if (locationSaving) return;
            setLocationSaving(true); setLocationError('');
            void (async () => {
              try {
                const error = await persistence.beforeLeaving(); if (error) throw new Error(error);
                const updated = await saveGardenLocation(persistence.getCurrent(), location);
                persistence.adopt(updated); setLocationOpen(false);
              } catch (error) { setLocationError(error instanceof Error ? error.message : t('location.failed')); }
              finally { setLocationSaving(false); }
            })();
          }} /></div>
        </Sheet>}</>}
    toolbar={<GardenToolbar dimensions={shown?.dimensions ?? null} bedCount={shown?.beds.length ?? 0}
      selectedBedName={shown?.beds.find((bed) => bed.id === selectedBedId)?.name}
      canUndo={layout.canUndo && !persistence.status.conflict} onUndo={() => { layout.undo(); setSelectedBedId(null); }}
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
          gardenId={garden.id} ownerId={garden.ownerId} onLocation={historyDraft ? undefined : () => { setPanel(null); setLocationOpen(true); }} location={persistence.getCurrent().location}
          beforeSignOut={persistence.beforeLeaving} onChooseGardens={() => void chooseGardens()}
          onHistory={historyDraft ? undefined : () => { setPanel(null); void history.show(); }}
          selectedBedId={selectedBedId} clipboard={clipboard} onEditBed={editBed}
          onDelete={() => { if (selectedBedId) removeBed(selectedBedId); }} />
  </EditorScreen>;
}
