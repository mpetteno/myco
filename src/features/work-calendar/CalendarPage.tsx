import { useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { EditorScreen } from '../../shared/ui/EditorScreen';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Button } from '../../shared/ui/Button';
import { FieldScope } from '../../shared/ui/FieldScope';
import { PageBackScope, usePageBackRegistry } from '../../shared/navigation/PageBackNavigation';
import { WorkspaceNav, useGuardedBack, useWorkspaceNavigation } from '../../shared/navigation/WorkspaceNavigation';
import { ThemeToggle } from '../appearance/ThemeToggle';
import { GrowingCalendar } from '../catalogue-reference/GrowingCalendar';
import type { SavedGarden } from '../gardens/gardenDocument';
import { loadGarden } from '../gardens/gardenRepository';
import { loadGardenEvent } from '../history/historyRepository';
import type { GardenEventSnapshot } from '../history/gardenHistory';
import { CalendarHistoryView } from './CalendarHistoryView';
import { WorkCalendar } from './WorkCalendar';
import type { WorkEntry } from './workModel';

export function CalendarPage({ user, garden, backLabel, onBack, active }: { user: User; garden: SavedGarden; backLabel: string; onBack: () => void; active: boolean }) {
  const [view, setView] = useState<'work' | 'seasonal'>('work'), [seasonalVisited, setSeasonalVisited] = useState(false);
  const [preview, setPreview] = useState<{ garden: SavedGarden; event: GardenEventSnapshot }>();
  const [planRequest, setPlanRequest] = useState<{ title: string; revision: number }>();
  const back = useGuardedBack(onBack), navigation = useWorkspaceNavigation();
  const { back: detailBack, register } = usePageBackRegistry();
  const activeRef = useRef(active); activeRef.current = active;
  function changeView(next: 'work' | 'seasonal') {
    const change = () => { if (next === 'seasonal') setSeasonalVisited(true); setView(next); };
    if (navigation) navigation.request(change); else change();
  }
  async function openHistory(entry: WorkEntry) {
    if (!entry.event) return;
    const [saved, event] = await Promise.all([loadGarden(entry.gardenId), loadGardenEvent(entry.gardenId, entry.event.id)]);
    if (activeRef.current) setPreview({ garden: saved, event });
  }
  return <>
    <div hidden={!!preview} inert={!!preview}>
      <EditorScreen toolbar={null} header={<PageHeader title="Calendar" subtitle={view === 'work' ? `${garden.name} · Work` : `${garden.name} · ${garden.location?.displayName ?? 'Set garden location'}`}
        back={view === 'seasonal' ? detailBack ?? { label: backLabel, onClick: back } : { label: backLabel, onClick: back }} actions={<><ThemeToggle /><WorkspaceNav /></>} />}>
        <div data-page-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
          <nav aria-label="Calendar views" className="grid grid-cols-2 gap-2"><Button variant={view === 'work' ? 'primary' : 'secondary'} aria-pressed={view === 'work'} onClick={() => changeView('work')}>Work</Button><Button variant={view === 'seasonal' ? 'primary' : 'secondary'} aria-pressed={view === 'seasonal'} onClick={() => changeView('seasonal')}>Seasonal guidance</Button></nav>
          <FieldScope prefix={view === 'work' ? '' : 'hidden-work-'}><div hidden={view !== 'work'} inert={view !== 'work'}><WorkCalendar garden={garden} planRequest={planRequest} visible={active && !preview && view === 'work'} onOpenHistory={openHistory} /></div></FieldScope>
          <FieldScope prefix={view === 'seasonal' ? '' : 'hidden-seasonal-'}><div hidden={view !== 'seasonal'} inert={view !== 'seasonal'}>
            <PageBackScope register={register} enabled={active && !preview && view === 'seasonal'} defaultLabel="Back to seasonal guidance">{seasonalVisited && <GrowingCalendar userId={user.id} garden={garden} onPlan={title => { setView('work'); setPlanRequest(previous => ({ title, revision: (previous?.revision ?? 0) + 1 })); }} />}</PageBackScope>
          </div></FieldScope>
        </div></div>
      </EditorScreen>
    </div>
    {preview && <CalendarHistoryView user={user} garden={preview.garden} event={preview.event} onBack={() => setPreview(undefined)} />}
  </>;
}
