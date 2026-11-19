import { FieldScope } from '../../shared/ui/FieldScope';
import type { SavedGarden } from './gardenDocument';
import { WorkspaceNavigation, WorkspaceBack, WorkspaceNav } from '../../shared/navigation/WorkspaceNavigation';
import type { Destination } from '../../shared/navigation/WorkspaceNavigation';
import { GrowingCalendar } from '../catalogue-reference/GrowingCalendar';
import { EditorScreen } from '../../shared/ui/EditorScreen';
import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Button } from '../../shared/ui/Button';
import { Sheet } from '../../shared/ui/Sheet';
import { AccountPanel } from '../auth/AccountPanel';
import { AuthShell } from '../auth/AuthShell';
import { GardenPage } from '../garden/GardenPage';
import { GardensPicker } from './GardensPicker';
import { useGardens } from './useGardens';
import { CataloguePage } from '../catalogue/CataloguePage';
import { useI18n } from '../../shared/i18n/I18nProvider';

export function GardensWorkspace({ user }: { user: User }) {
  const { t } = useI18n();
  const store = useGardens(user.id);
  const [picking, setPicking] = useState(false);
  const [editorContext, setEditorContext] = useState<'garden' | 'bed' | 'area'>('garden');
  const [latestGarden, setLatestGarden] = useState<SavedGarden>();
  const calendarGarden = latestGarden?.id === store.active?.id ? latestGarden : store.active;
  const [accountOpen, setAccountOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [destination, setDestination] = useState<Destination>('gardens');
  const catalogueOpen = destination !== 'gardens';
  const [catalogueVisited, setCatalogueVisited] = useState(false);
  const [calendarVisited, setCalendarVisited] = useState(false);
  const [returnToPicker, setReturnToPicker] = useState(false);

  function openCatalogue(fromPicker: boolean) {
    setReturnToPicker(fromPicker); setPicking(false); setCatalogueVisited(true); setDestination('catalogue');
  }

  function navigate(next: Destination) {
    setPicking(false);
    if (next === 'catalogue') setCatalogueVisited(true);
    if (next === 'calendar') setCalendarVisited(true);
    setDestination(next);
  }
  function back() { setDestination('gardens'); setPicking(returnToPicker); }
  return (
    <WorkspaceNavigation destination={destination} onNavigate={navigate}>
      {/* Keep the editor draft mounted: the active document may predate its latest autosave. */}
      <FieldScope prefix={catalogueOpen ? 'hidden-gardens-' : ''}><div data-workspace-screen="gardens" hidden={catalogueOpen} inert={catalogueOpen}>
      {store.active && !store.loading && !store.error ? (
        <GardenPage key={`${store.active.id}:${store.editorVersion}`} user={user} garden={store.active}
          onEditorContextChange={setEditorContext} onSaved={(garden) => { store.remember(garden); setLatestGarden(garden); }} pickerOpen={picking || catalogueOpen} onChooseGardens={() => setPicking(true)}
          onOpenCatalogue={() => openCatalogue(false)}
          onReload={() => store.choose(store.active!.id)} onDiscardChanges={store.retry} />
      ) : (
        <AuthShell title={store.loading ? 'Loading your gardens' : 'Your gardens'}>
          {store.loading ? <p role="status">Loading…</p> : store.error ? <>
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">{store.error}</p>
            <Button onClick={store.retry}>Try again</Button>
          </> : <>
            <p className="text-sm text-stone-600 dark:text-stone-400">Create your first garden to start planning, or refresh to check for gardens shared with you.</p>
            <Button onClick={() => setPicking(true)}>Create a garden</Button>
            <Button variant="secondary" onClick={store.retry}>Refresh gardens</Button>
          </>}
          <Button variant="secondary" onClick={() => setAccountOpen(true)}>Account</Button>
          <Button variant="secondary" onClick={() => openCatalogue(false)}>{t('catalogue.title')}</Button>
          <Button variant="secondary" onClick={() => navigate('calendar')}>Growing calendar</Button>
        </AuthShell>
      )}
      {picking && <Sheet title="Your gardens" dismissible={!changing} onClose={() => setPicking(false)}>
        <div className="mb-4"><Button variant="secondary" disabled={changing} onClick={() => openCatalogue(true)}>{t('catalogue.title')}</Button></div>
        <GardensPicker gardens={store.gardens} currentId={store.active?.id}
          userId={user.id} onRefresh={store.refresh}
          onPendingChange={setChanging}
          onChoose={async (id) => { await store.choose(id); setPicking(false); }}
          onCreate={async (document) => { await store.create(document); setPicking(false); }} />
      </Sheet>}
      {accountOpen && <Sheet title="Account" onClose={() => setAccountOpen(false)}><AccountPanel user={user} /></Sheet>}
      </div>
      </FieldScope>
      <FieldScope prefix={destination !== 'catalogue' ? 'hidden-catalogue-' : ''}><div data-workspace-screen="catalogue" hidden={destination !== 'catalogue'} inert={destination !== 'catalogue'}>
      {catalogueVisited && <CataloguePage userId={user.id} backLabel={store.active && !returnToPicker ? `Back to ${editorContext}` : undefined} onBack={back} garden={calendarGarden ?? undefined} />}
      </div>
      </FieldScope>
      <FieldScope prefix={destination !== 'calendar' ? 'hidden-calendar-' : ''}><div data-workspace-screen="calendar" hidden={destination !== 'calendar'} inert={destination !== 'calendar'}>
        {calendarVisited && <EditorScreen toolbar={null} header={<header className="flex items-center gap-3 border-b border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900"><WorkspaceBack onBack={back}>Back to {store.active ? editorContext : 'gardens'}</WorkspaceBack><h1 tabIndex={-1} className="min-w-0 flex-1 text-lg font-semibold">Growing calendar</h1><WorkspaceNav /></header>}>
          <div data-page-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="mx-auto max-w-4xl p-4 sm:p-6"><GrowingCalendar userId={user.id} garden={calendarGarden ?? undefined} /></div></div>
        </EditorScreen>}
      </div>
      </FieldScope>
    </WorkspaceNavigation>
  );
}
