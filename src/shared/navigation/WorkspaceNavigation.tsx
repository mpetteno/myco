import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';

export type Destination = 'gardens' | 'catalogue' | 'calendar';
type Guard = { save: () => Promise<boolean>; discard: () => void; pending: boolean };
type Navigation = { destination: Destination; navigate: (destination: Destination) => void; request: (action: () => void) => void;
  register: (guard: Guard | null) => void; suspended: boolean };
const Context = createContext<Navigation | null>(null);
export const useWorkspaceNavigation = () => useContext(Context);

export function WorkspaceNavigation({ destination, onNavigate, children }: { destination: Destination; onNavigate: (next: Destination) => void; children: ReactNode }) {
  const guard = useRef<Guard | null>(null);
  const previous = useRef(destination);
  useLayoutEffect(() => {
    if (previous.current === destination) return;
    previous.current = destination;
    const heading = document.querySelector<HTMLElement>(`[data-workspace-screen="${destination}"] h1`);
    heading?.setAttribute('tabindex','-1'); heading?.focus({ preventScroll: true });
  }, [destination]);
  const [intent, setIntent] = useState<{ action: () => void }>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const register = useCallback((next: Guard | null) => { guard.current = next; }, []);
  const request = useCallback((action: () => void) => {
    if (guard.current) { setError(''); setIntent({ action }); } else action();
  }, []);
  async function leave(save: boolean) {
    if (!intent || saving || guard.current?.pending) return;
    setSaving(true); setError('');
    try {
      if (save && guard.current && !await guard.current.save()) { setError('Unable to leave. Check the form and save again, or stay to continue editing.'); return; }
      if (!save) guard.current?.discard();
      const action = intent.action; setIntent(undefined); action();
    } catch { setError('Your changes could not be saved. Stay to review them or try again.'); }
    finally { setSaving(false); }
  }
  return <Context value={{ destination, navigate: (next) => request(() => onNavigate(next)), request, register, suspended: !!intent }}>
    {children}
    {intent && <Sheet title="Unsaved catalogue changes" dismissible={!saving} onClose={() => setIntent(undefined)}>
      <div className="space-y-3"><p>Save your changes before leaving, or discard them.</p>
        {error && <p role="alert">{error}</p>}
        <Button disabled={saving || guard.current?.pending} onClick={() => void leave(true)}>Save and leave</Button>
        <Button variant="danger" disabled={saving || guard.current?.pending} onClick={() => void leave(false)}>Discard and leave</Button>
        <Button variant="secondary" disabled={saving} onClick={() => setIntent(undefined)}>Stay</Button>
      </div>
    </Sheet>}
  </Context>;
}

export function WorkspaceNav() {
  const navigation = useWorkspaceNavigation();
  const [open, setOpen] = useState(false);
  if (!navigation) return null;
  return <>
    <button type="button" aria-label="App menu" aria-haspopup="dialog" aria-expanded={open}
      className="min-h-11 shrink-0 cursor-pointer rounded-lg px-2 text-sm font-medium hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:bg-stone-800"
      onClick={() => setOpen(true)}>Menu</button>
    {open && <Sheet title="Navigate" onClose={() => setOpen(false)}>
      <nav aria-label="App navigation" className="space-y-2">
        {(['gardens', 'catalogue', 'calendar'] as const).map((destination) => <Button key={destination} variant="secondary"
          aria-current={navigation.destination === destination ? 'page' : undefined}
          onClick={() => { setOpen(false); if (navigation.destination !== destination) navigation.navigate(destination); }}>
          {destination === 'gardens' ? 'Gardens' : destination === 'catalogue' ? 'Catalogue' : 'Growing calendar'}
        </Button>)}
      </nav>
    </Sheet>}
  </>;
}

// Register the actual form save operation, so navigation shares validation and error handling.
export function useFormLeave(dirty: boolean, pending: boolean, submit: (event: FormEvent<HTMLFormElement>) => Promise<boolean | void>, discard: () => void) {
  const navigation = useWorkspaceNavigation();
  const form = useRef<HTMLFormElement>(null);
  const latest = useRef({ submit, discard, pending });
  useLayoutEffect(() => { latest.current = { submit, discard, pending }; });
  const register = navigation?.register;
  useLayoutEffect(() => {
    if (!register || !dirty) return;
    register({ pending, discard: () => latest.current.discard(), save: async () => {
      if (!form.current?.reportValidity() || latest.current.pending) return false;
      return await latest.current.submit({ preventDefault() {} } as FormEvent<HTMLFormElement>) === true;
    } });
    return () => register(null);
  }, [register, dirty, pending]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  return form;
}


export function WorkspaceBack({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  const navigation = useWorkspaceNavigation();
  return <Button variant="secondary" onClick={() => navigation ? navigation.request(onBack) : onBack()}>{children}</Button>;
}
export function useGuardedBack(onBack: () => void) {
  const navigation = useWorkspaceNavigation();
  return () => navigation ? navigation.request(onBack) : onBack();
}
