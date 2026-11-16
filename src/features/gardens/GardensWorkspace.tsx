import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Button } from '../../shared/ui/Button';
import { Sheet } from '../../shared/ui/Sheet';
import { AccountPanel } from '../auth/AccountPanel';
import { AuthShell } from '../auth/AuthShell';
import { GardenPage } from '../garden/GardenPage';
import { GardensPicker } from './GardensPicker';
import { useGardens } from './useGardens';
import { PlantCataloguePanel } from '../catalogue/PlantCataloguePanel';
import { MulchCataloguePanel } from '../mulch-catalogue/MulchCataloguePanel';

export function GardensWorkspace({ user }: { user: User }) {
  const store = useGardens(user.id);
  const [picking, setPicking] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [mulchOpen, setMulchOpen] = useState(false);

  return (
    <>
      {store.active && !store.loading && !store.error ? (
        <GardenPage key={`${store.active.id}:${store.editorVersion}`} user={user} garden={store.active}
          onSaved={store.remember} pickerOpen={picking} onChooseGardens={() => setPicking(true)}
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
          <Button variant="secondary" onClick={() => setCatalogueOpen(true)}>Plant catalogue</Button>
          <Button variant="secondary" onClick={() => setMulchOpen(true)}>Mulch catalogue</Button>
        </AuthShell>
      )}
      {picking && <Sheet title="Your gardens" dismissible={!changing} onClose={() => setPicking(false)}>
        <GardensPicker gardens={store.gardens} currentId={store.active?.id}
          userId={user.id} onRefresh={store.refresh}
          onPendingChange={setChanging}
          onChoose={async (id) => { await store.choose(id); setPicking(false); }}
          onCreate={async (document) => { await store.create(document); setPicking(false); }} />
      </Sheet>}
      {accountOpen && <Sheet title="Account" onClose={() => setAccountOpen(false)}><AccountPanel user={user} /></Sheet>}
      {catalogueOpen && <Sheet title="Plant catalogue" onClose={() => setCatalogueOpen(false)}><PlantCataloguePanel userId={user.id} /></Sheet>}
      {mulchOpen && <Sheet title="Mulch catalogue" onClose={() => setMulchOpen(false)}><MulchCataloguePanel userId={user.id} /></Sheet>}
    </>
  );
}
