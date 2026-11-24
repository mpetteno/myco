import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { PageHeader } from '../../shared/ui/PageHeader';
import { EditorScreen } from '../../shared/ui/EditorScreen';
import { WorkspaceNav, useGuardedBack } from '../../shared/navigation/WorkspaceNavigation';
import { ThemeToggle } from '../appearance/ThemeToggle';
import type { SavedGarden } from '../gardens/gardenDocument';
import type { GardenEventSnapshot } from '../history/gardenHistory';
import { useGardenHistory } from '../history/useGardenHistory';
import { GardenHistoryInspector } from '../history/GardenHistoryInspector';
import { HistoryEditPage } from '../history/HistoryEditPage';
import { GardenCanvas } from '../garden/GardenCanvas';
import { CanvasNavigation } from '../plan-camera/CanvasNavigation';
import type { CameraCommand } from '../plan-camera/planCamera';

export function CalendarHistoryView({ user, garden, event, onBack }: { user: User; garden: SavedGarden; event: GardenEventSnapshot; onBack: () => void }) {
  const before = useCallback(async () => null, []), current = useCallback(() => garden, [garden]);
  const history = useGardenHistory(garden.id, before, current, event.bedId);
  const back = useGuardedBack(onBack);
  const [selected, setSelected] = useState<string | null>(event.bedId ?? null), [panning, setPanning] = useState(false), [command, setCommand] = useState<CameraCommand>();
  useEffect(() => {
    let active = true;
    void history.show().then(() => { if (active) void history.select(event); });
    return () => { active = false; };
  }, [event.id]);
  const shown = history.current ? garden : history.selected?.document;
  if (history.editingHistory) return <HistoryEditPage key={`${history.editingHistory.event?.id ?? 'new'}:${history.editingHistory.event?.eventVersion ?? 0}`} draft={history.editingHistory} current={garden} user={user}
    onBack={history.closeHistoryEdit} onSaved={history.historyEdited} onReload={history.reloadHistoryEdit} />;
  return <EditorScreen header={<PageHeader title={`${garden.name} · History`} subtitle="Read-only inspection" back={{ label: 'Back to calendar', disabled: history.saving, onClick: back }} actions={<><ThemeToggle /><WorkspaceNav /></>} />} toolbar={null}>
    <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">{shown && !history.loading && !history.error ? <GardenCanvas key={history.selected?.id ?? 'current'} dimensions={shown.dimensions} beds={shown.beds} readOnly
          selectedBedId={selected} onSelectBed={setSelected} onEditBed={() => {}} onMoveBed={() => {}} onResizeBed={() => {}} onSetup={() => {}} cameraCommand={command} panning={panning} />
          : <p role={history.error ? 'alert' : 'status'} className="p-4 text-sm">{history.loading ? 'Loading recorded layout…' : history.error || 'No recorded layout for this date.'}</p>}</div>
        <div className="shrink-0 border-t border-stone-200 bg-white px-2 dark:border-stone-700 dark:bg-stone-900"><CanvasNavigation scope="Garden" selected={!!shown?.beds.some(bed => bed.id === selected)} panning={panning} disabled={!shown || history.loading || history.saving}
          onPan={() => setPanning(value => !value)} onCamera={action => setCommand(previous => ({ action, targetId: selected ?? undefined, revision: (previous?.revision ?? 0) + 1 }))} /></div>
      </div>
      <GardenHistoryInspector inspectionOnly onClose={back} history={history} onReload={history.refresh} />
    </div>
  </EditorScreen>;
}
