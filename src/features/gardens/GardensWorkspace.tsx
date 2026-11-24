import { FieldScope } from '../../shared/ui/FieldScope';
import type { SavedGarden } from './gardenDocument';
import { WorkspaceNavigation, WorkspaceNav } from '../../shared/navigation/WorkspaceNavigation';
import type { Destination } from '../../shared/navigation/WorkspaceNavigation';
import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Button } from '../../shared/ui/Button';
import { Sheet } from '../../shared/ui/Sheet';
import { AuthShell } from '../auth/AuthShell';
import { GardenPage } from '../garden/GardenPage';
import { GardensPicker } from './GardensPicker';
import { useGardens } from './useGardens';
import { CalendarPage } from '../work-calendar/CalendarPage';
import { CataloguePage } from '../catalogue/CataloguePage';
import { useI18n } from '../../shared/i18n/I18nProvider';

export function GardensWorkspace({ user }: { user: User }) {
  const { t } = useI18n();
  const store = useGardens(user.id);
  const [picking, setPicking] = useState(false);
  const [creatingGarden, setCreatingGarden] = useState(false);
  const [editorContext, setEditorContext] = useState<'garden' | 'bed' | 'area'>('garden');
  const [latestGarden, setLatestGarden] = useState<SavedGarden>();
  const calendarGarden = latestGarden?.id === store.active?.id ? latestGarden : store.active;
  const [changing, setChanging] = useState(false);
  const [destination, setDestination] = useState<Destination>('gardens');
  const catalogueOpen = destination !== 'gardens';
  const [catalogueVisited, setCatalogueVisited] = useState(false);
  const [calendarVisited, setCalendarVisited] = useState(false);
  const [trail, setTrail] = useState<{ destination: Destination; picking: boolean }[]>([]);
  const previous = trail.at(-1);
  const backLabel = previous?.destination === 'calendar' ? 'Back to calendar'
    : previous?.destination === 'catalogue' ? 'Back to catalogue'
    : store.active && !previous?.picking ? `Back to ${editorContext}` : t('catalogue.backToGardens');

  function navigate(next: Destination) {
    if (next === destination) return;
    setTrail([...trail, { destination, picking }]);
    setPicking(false);
    if (next === 'catalogue') setCatalogueVisited(true);
    if (next === 'calendar') setCalendarVisited(true);
    setDestination(next);
  }
  function back() {
    setTrail(trail.slice(0, -1));
    setDestination(previous?.destination ?? 'gardens'); setPicking(previous?.picking ?? false);
  }
  async function deleteActiveGarden(garden: SavedGarden) {
    await store.remove(garden);
    setLatestGarden(undefined); setCalendarVisited(false); setTrail([]); setDestination('gardens');
    setCreatingGarden(false); setPicking(store.gardens.some((item) => item.id !== garden.id));
  }
  return (
    <WorkspaceNavigation destination={destination} onNavigate={navigate} user={user}>
      {/* Keep the editor draft mounted: the active document may predate its latest autosave. */}
      <FieldScope prefix={catalogueOpen ? 'hidden-gardens-' : ''}><div data-workspace-screen="gardens" hidden={catalogueOpen} inert={catalogueOpen}>
      {store.active && !store.loading && !store.error ? (
        <GardenPage key={`${store.active.id}:${store.editorVersion}`} user={user} garden={store.active}
          onEditorContextChange={setEditorContext} onSaved={(garden) => { store.remember(garden); setLatestGarden(garden); }} pickerOpen={picking || catalogueOpen} onChooseGardens={() => setPicking(true)}
          onOpenCalendar={() => navigate('calendar')} onDeleteGarden={deleteActiveGarden}
          onReload={() => store.choose(store.active!.id)} onDiscardChanges={store.retry} />
      ) : (
        <AuthShell title={store.loading ? 'Loading your gardens' : 'Your gardens'} actions={<WorkspaceNav />}>
          {store.loading ? <p role="status">Loading…</p> : store.error ? <>
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">{store.error}</p>
            <Button onClick={store.retry}>Try again</Button>
          </> : <>
            <p className="text-sm text-stone-600 dark:text-stone-400">Create your first garden to start planning, or refresh to check for gardens shared with you.</p>
            <Button onClick={() => setPicking(true)}>Create a garden</Button>
            <Button variant="secondary" onClick={store.retry}>Refresh gardens</Button>
          </>}
        </AuthShell>
      )}
      {picking && <Sheet title={creatingGarden || !store.gardens.length ? 'Create garden' : 'Your gardens'} dismissible={!changing} onClose={() => setPicking(false)}>
        <GardensPicker gardens={store.gardens} currentId={store.active?.id}
          userId={user.id} onRefresh={store.refresh}
          onPendingChange={setChanging} onCreatingChange={setCreatingGarden}
          onChoose={async (id) => { await store.choose(id); setPicking(false); }}
          onCreate={async (document) => { await store.create(document); setPicking(false); }} />
      </Sheet>}
      </div>
      </FieldScope>
      <FieldScope prefix={destination !== 'catalogue' ? 'hidden-catalogue-' : ''}><div data-workspace-screen="catalogue" hidden={destination !== 'catalogue'} inert={destination !== 'catalogue'}>
      {catalogueVisited && <CataloguePage userId={user.id} backLabel={backLabel} onBack={back} garden={calendarGarden ?? undefined} />}
      </div>
      </FieldScope>
      <FieldScope prefix={destination !== 'calendar' ? 'hidden-calendar-' : ''}><div data-workspace-screen="calendar" hidden={destination !== 'calendar'} inert={destination !== 'calendar'}>
        {calendarVisited && calendarGarden && <CalendarPage key={calendarGarden.id} user={user} garden={calendarGarden} active={destination === 'calendar'} backLabel={backLabel} onBack={back} />}
      </div>
      </FieldScope>
    </WorkspaceNavigation>
  );
}
