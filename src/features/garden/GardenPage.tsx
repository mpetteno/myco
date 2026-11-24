import { EditHistoryActions } from '../../shared/ui/EditHistoryActions';
import { WorkspaceNav, useWorkspaceNavigation, useWorkspaceBeforeSignOut } from '../../shared/navigation/WorkspaceNavigation';
import { useEditorShortcuts } from '../../shared/keyboard/useEditorShortcuts';
import { useAreaClipboard } from '../area-editor/useAreaClipboard';
import { GardenLocationForm } from '../gardens/GardenLocationForm';
import { saveGardenLocation } from '../gardens/gardenRepository';
import { Sheet } from '../../shared/ui/Sheet';
import { useI18n } from '../../shared/i18n/I18nProvider';
import type { HistoryEditorOptions } from '../history/historyDraft';
import { HistoryEditPage } from '../history/HistoryEditPage';
import { ThemeToggle } from '../appearance/ThemeToggle';
import { useCallback, useImperativeHandle, useState, useEffect } from 'react';
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
import { GardenHistoryInspector } from '../history/GardenHistoryInspector';
import { GardenStorageError } from '../gardens/gardenErrors';
import { CanvasNavigation } from '../plan-camera/CanvasNavigation';
import type { CameraCommand } from '../plan-camera/planCamera';

type GardenPageProps = {
  user: User; garden: SavedGarden; historyDraft?: HistoryEditorOptions; onSaved: (garden: SavedGarden) => void;
  onChooseGardens: () => void; pickerOpen: boolean; onReload: () => Promise<void>;
  onDiscardChanges: () => void;
  onEditorContextChange?: (context: 'garden' | 'bed' | 'area') => void;
  onOpenCalendar?: () => void;
  onDeleteGarden?: (current: SavedGarden) => Promise<void>;
};

export function GardenPage({ user, garden, onSaved, onChooseGardens, pickerOpen, onReload, onDiscardChanges, historyDraft, onEditorContextChange, onOpenCalendar, onDeleteGarden }: GardenPageProps) {
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
  const [resizingBedId, setResizingBedId] = useState<string | null>(null);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>();
  const [panning, setPanning] = useState(false);
  function moveCamera(action: CameraCommand['action']) {
    setCameraCommand((previous) => ({ action, targetId: selectedBedId ?? undefined, revision: (previous?.revision ?? 0) + 1 }));
  }
  const [resizeError, setResizeError] = useState<string | null>(null);
  useEffect(() => { setResizeError(null); }, [resizingBedId, selectedBedId]);
  function selectBed(id: string | null) { if (id !== selectedBedId) setResizingBedId(null); setSelectedBedId(id); }
  function undo() { setResizingBedId(null); layout.undo(); setSelectedBedId(null); }
  function redo() { setResizingBedId(null); layout.redo(); setSelectedBedId(null); }
  const [panel, setPanel] = useState<GardenPanel | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [editingBedId, setEditingBedId] = useState<string | null>(historyDraft?.bedId ?? null);
  const readOnly = !history.current || history.saving;
  const shown = history.current ? layout : history.selected?.document;
  const editingBed = readOnly ? undefined : layout.beds.find((bed) => bed.id === editingBedId);
  const [bedDraftValid, setBedDraftValid] = useState(true);
  const onBedValidityChange = useCallback((valid: boolean) => { setBedDraftValid(valid); historyDraft?.onValidityChange(valid); }, [historyDraft?.onValidityChange]);
  async function beforeSignOut() {
    if (historyDraft) return 'Save or discard the historical draft before signing out.';
    if (editingBed && !bedDraftValid) return 'Complete or discard the area settings before signing out.';
    return persistence.beforeLeaving();
  }
  useWorkspaceBeforeSignOut(beforeSignOut);

  useEffect(() => { if (readOnly || (navigation && navigation.destination !== 'gardens')) setResizingBedId(null); }, [readOnly, navigation?.destination]);
  useEffect(() => { if (!editingBed) onEditorContextChange?.('garden'); }, [editingBed, onEditorContextChange]);

  function removeBed(id: string) {
    if (readOnly || historyDraft?.bedId) return;
    setResizingBedId(null);
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
    onPaste: (copy) => readOnly ? null : layout.pasteBed(copy), onSelect: selectBed,
    enabled: shortcutsEnabled && !historyDraft?.bedId,
  });
  const areaClipboard = useAreaClipboard();
  useEditorShortcuts({ enabled: shortcutsEnabled,
    onUndo: layout.canUndo ? undo : undefined,
    onRedo: layout.canRedo ? redo : undefined,
  });

  function editBed(id: string) {
    if (readOnly || (historyDraft?.bedId && historyDraft.bedId !== id)) return;
    setResizingBedId(null); setSelectedBedId(id); setPanel(null); setEditingBedId(id);
  }

  function openPanel(next: GardenPanel) {
    if (next === 'add') { setSelectedBedId(null); setPanning(false); }
    setPanel(next);
  }

  async function chooseGardens() {
    if (leaving) return;
    setLeaving(true);
    const error = await persistence.beforeLeaving();
    if (!error) { setPanel(null); onChooseGardens(); }
    setLeaving(false);
  }
  async function openCalendar() {
    if (leaving || !onOpenCalendar) return;
    setLeaving(true); setPanel(null);
    try { if (!await persistence.beforeLeaving()) onOpenCalendar(); }
    finally { setLeaving(false); }
  }
  async function deleteCurrentGarden() {
    const error = await persistence.beforeLeaving();
    if (error) throw new GardenStorageError(error, persistence.status.conflict);
    await onDeleteGarden?.(persistence.getCurrent());
  }
  const feedback = <GardenSaveFeedback status={persistence.status} onRetry={persistence.beforeLeaving} onReload={onReload} onDiscardChanges={onDiscardChanges} />;
  if (history.editingHistory) return <HistoryEditPage key={`${history.editingHistory.event?.id ?? 'new'}:${history.editingHistory.event?.eventVersion ?? 0}`} onReload={history.reloadHistoryEdit} draft={history.editingHistory} current={persistence.getCurrent()} user={user} onBack={history.closeHistoryEdit} onSaved={history.historyEdited} />;
  if (editingBed) return <BedPage key={editingBed.id} bed={editingBed} user={user} userId={user.id} status={persistence.status} feedback={feedback}
    onEditorContextChange={onEditorContextChange} historyDraft={!!historyDraft} onValidityChange={onBedValidityChange}
    onOpenCalendar={onOpenCalendar ? () => void openCalendar() : undefined} calendarVisible={!pickerOpen} gardenId={garden.id} getCurrent={persistence.getCurrent} onReload={onReload}
    onSaveDetails={(details) => layout.saveBed(details, editingBed.id)} onSavePlan={(plans) => layout.saveBedPlan(editingBed.id, plans)}
    onPosition={(position) => layout.positionBed(editingBed.id, position)}
    beforeLeaving={persistence.beforeLeaving} onBack={() => setEditingBedId(null)} onDelete={() => removeBed(editingBed.id)}
    onCopy={clipboard.copy} copyMessage={clipboard.feedback.text} areaClipboard={areaClipboard} />;

  return <EditorScreen
    header={<><header data-page-header inert={history.saving} className="flex h-18 shrink-0 items-center gap-2 border-b border-stone-200 bg-white px-2 sm:grid sm:grid-cols-[16rem_minmax(0,1fr)_16rem] sm:px-4 dark:border-stone-800 dark:bg-stone-900">
          <div className="contents sm:flex sm:min-w-0 sm:items-center">
          <h1 className="sr-only text-base leading-6 font-semibold text-green-800 sm:not-sr-only sm:shrink-0 dark:text-green-400">Myco</h1>
          </div>
          <button type="button" disabled={leaving || !!historyDraft} onClick={() => void chooseGardens()}
            aria-label={`Choose garden. Current garden: ${layout.name}.`} aria-haspopup="dialog" title="Choose garden"
            className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-2 text-center hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-green-600 disabled:cursor-default disabled:opacity-50 dark:hover:bg-stone-800">
            <span className="min-w-0">
              <span title={shown?.name ?? layout.name} className="block truncate text-base leading-6 font-semibold">{shown?.name ?? layout.name}</span>
              {(historyDraft || !history.current) && <span className="block h-4 truncate text-xs leading-4 text-stone-600 dark:text-stone-400">{historyDraft ? 'History draft' : 'History · read only'}</span>}
            </span>
            {!historyDraft && <svg aria-hidden="true" className="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>}
          </button>
          <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          <EditHistoryActions canUndo={layout.canUndo} canRedo={layout.canRedo} onUndo={undo} onRedo={redo}
            disabled={readOnly || leaving || !!persistence.status.conflict} />
          <ThemeToggle /><WorkspaceNav user={user} beforeSignOut={beforeSignOut} onChooseGardens={() => void chooseGardens()} />
          </div>
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
    toolbar={<GardenToolbar resizing={!!resizingBedId && resizingBedId === selectedBedId} onResizeBed={() => { setPanning(false); setResizingBedId(resizingBedId === selectedBedId ? null : selectedBedId); }} dimensions={shown?.dimensions ?? null}
      onCalendar={historyDraft ? undefined : () => { setPanel(null); setResizingBedId(null); if (history.open) history.close(); else void history.show(); }} calendarOpen={history.open}
      selectedBedName={shown?.beds.find((bed) => bed.id === selectedBedId)?.name}
      readOnly={readOnly} bedScope={!!historyDraft?.bedId} disabled={history.saving}
      hasSelection={!!shown?.beds.some((bed) => bed.id === selectedBedId) && (!historyDraft?.bedId || historyDraft.bedId === selectedBedId)} onOpen={openPanel} onEditBed={() => { if (selectedBedId) editBed(selectedBedId); }} />}>
        <div className="relative flex min-h-0 w-full flex-1 flex-col lg:flex-row">
          <div inert={leaving || history.saving} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <div className="pointer-events-none absolute inset-x-2 top-2 z-30 max-h-[70%] overflow-y-auto [&>*]:pointer-events-auto [&>*]:rounded-lg [&>*]:shadow-lg">
              {!historyDraft && persistence.status.state === 'saving' && <div className="ml-auto w-fit border border-stone-200 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900" role="status">Saving…</div>}
              {feedback}
            </div>
            {resizeError && <p role="status" className="pointer-events-none absolute inset-x-2 bottom-2 z-20 rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-sm text-amber-950 shadow-lg dark:border-amber-800 dark:bg-amber-950/95 dark:text-amber-100">{resizeError}</p>}
            {shown && (!history.open || history.current || (!history.loading && !history.error)) ? <GardenCanvas key={history.current ? 'current' : history.selected?.id} dimensions={shown.dimensions} beds={shown.beds}
              onMoveBed={(id, position) => { if (!readOnly && (!historyDraft?.bedId || historyDraft.bedId === id)) layout.moveBed(id, position); }}
              onResizeBed={(id, bounds) => { if (!readOnly && (!historyDraft?.bedId || historyDraft.bedId === id)) layout.resizeBed(id, bounds); }}
              onResizeBlocked={setResizeError}
              cameraCommand={cameraCommand} panning={panning}
              selectedBedId={selectedBedId} onSelectBed={selectBed} resizing={resizingBedId === selectedBedId && !!selectedBedId} readOnly={readOnly}
              onEditBed={editBed} editableBedId={historyDraft?.bedId}
              onSetup={() => { if (!readOnly) openPanel('garden'); }} />
              : <div className="flex h-full items-center justify-center p-6 text-center text-sm text-stone-600 dark:text-stone-400">
                {history.loading ? 'Loading the recorded layout…' : history.error || `No layout was recorded on or before ${history.date}. Choose a later date or return to the current plan.`}
              </div>}
          </div>
          <div className="shrink-0 border-t border-stone-200 bg-white px-2 dark:border-stone-800 dark:bg-stone-900">
            <CanvasNavigation scope="Garden" selected={!!shown?.beds.some((bed) => bed.id === selectedBedId)} panning={panning}
              disabled={!shown || history.saving || leaving || (history.open && !history.current && (history.loading || !!history.error))}
              onCamera={moveCamera} onPan={() => { setPanning(!panning); setResizingBedId(null); }} />
          </div>
          </div>
          <GardenHistoryInspector history={history} onReload={onReload} visible={!pickerOpen} onFullCalendar={onOpenCalendar ? () => void openCalendar() : undefined} />
        </div>
        <GardenPanels historyDraft={!!historyDraft} bedScope={historyDraft?.bedId} panel={panel} onPanelChange={setPanel} layout={{ ...layout, ...(shown ?? { beds: [] }) }} user={user} readOnly={readOnly}
          gardenId={garden.id} ownerId={garden.ownerId} onLocation={historyDraft ? undefined : () => { setPanel(null); setLocationOpen(true); }}
          onDeleteGarden={onDeleteGarden ? deleteCurrentGarden : undefined} onReload={onReload}
          selectedBedId={selectedBedId} clipboard={clipboard}
          onCreatedBed={(id) => { setSelectedBedId(id); setResizingBedId(id); }}
          onEditBed={editBed}
          onDelete={() => { if (selectedBedId) removeBed(selectedBedId); }} />
  </EditorScreen>;
}
