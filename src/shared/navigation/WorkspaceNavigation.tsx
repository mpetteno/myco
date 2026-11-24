import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { BackButton } from '../ui/BackButton';
import type { User } from '@supabase/supabase-js';
import { AccountPanel } from '../../features/auth/AccountPanel';
import { GardenHelp } from '../../features/garden/GardenHelp';

export type Destination = 'gardens' | 'catalogue' | 'calendar';
type Guard = { save: () => Promise<boolean>; discard: () => void; pending: boolean };
type Navigation = { destination: Destination; navigate: (destination: Destination) => void; request: (action: () => void) => void;
  register: (guard: Guard | null) => void; suspended: boolean; user?: User;
  registerBeforeSignOut: (callback: () => Promise<string | null>) => () => void; beforeSignOut: () => Promise<string | null> };
const Context = createContext<Navigation | null>(null);
export const useWorkspaceNavigation = () => useContext(Context);

export function WorkspaceNavigation({ destination, onNavigate, children, user }: { destination: Destination; onNavigate: (next: Destination) => void; children: ReactNode; user?: User }) {
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
  const signOutChecks = useRef<(() => Promise<string | null>)[]>([]);
  const registerBeforeSignOut = useCallback((callback: () => Promise<string | null>) => {
    signOutChecks.current.push(callback);
    return () => { signOutChecks.current = signOutChecks.current.filter((item) => item !== callback); };
  }, []);
  async function beforeSignOut() {
    if (guard.current) return 'Save or discard your current form changes before signing out.';
    return await signOutChecks.current.at(-1)?.() ?? null;
  }
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
  return <Context value={{ destination, navigate: (next) => request(() => onNavigate(next)), request, register, suspended: !!intent, user, registerBeforeSignOut, beforeSignOut }}>
    {children}
    {intent && <Sheet title="Unsaved changes" dismissible={!saving} onClose={() => setIntent(undefined)}>
      <div className="space-y-3"><p>Save your changes before leaving, or discard them.</p>
        {error && <p role="alert">{error}</p>}
        <Button disabled={saving || guard.current?.pending} onClick={() => void leave(true)}>Save and leave</Button>
        <Button variant="danger" disabled={saving || guard.current?.pending} onClick={() => void leave(false)}>Discard and leave</Button>
        <Button variant="secondary" disabled={saving} onClick={() => setIntent(undefined)}>Stay</Button>
      </div>
    </Sheet>}
  </Context>;
}

export function WorkspaceNav({ user: suppliedUser, beforeSignOut, onChooseGardens }: { user?: User; beforeSignOut?: () => Promise<string | null>; onChooseGardens?: () => void } = {}) {
  const navigation = useWorkspaceNavigation();
  const [open, setOpen] = useState(false);
  const [general, setGeneral] = useState<'help' | 'account' | null>(null);
  const user = suppliedUser ?? navigation?.user;
  if (!navigation && !user) return null;
  return <>
    <button type="button" aria-label="App menu" aria-haspopup="dialog" aria-expanded={open}
      className="min-h-11 shrink-0 cursor-pointer rounded-lg px-2 text-sm font-medium hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:bg-stone-800"
      onClick={() => setOpen(true)}>Menu</button>
    {open && <Sheet title="Menu" onClose={() => setOpen(false)}>
      <nav aria-label="App navigation" className="space-y-2">
        {navigation && (['gardens', 'catalogue'] as const).map((destination) => <Button key={destination} variant="secondary"
          aria-current={navigation.destination === destination ? 'page' : undefined}
          onClick={() => { setOpen(false); if (navigation.destination !== destination) navigation.navigate(destination); }}>
          {destination === 'gardens' ? 'Gardens' : 'Catalogue'}
        </Button>)}
        {!navigation && onChooseGardens && <Button variant="secondary" onClick={() => { setOpen(false); onChooseGardens(); }}>Your gardens</Button>}
        <Button variant="secondary" onClick={() => { setOpen(false); setGeneral('help'); }}>Help</Button>
        {user && <Button variant="secondary" onClick={() => { setOpen(false); setGeneral('account'); }}>Account</Button>}
      </nav>
    </Sheet>}
    {general && <Sheet title={general === 'help' ? 'How to use Myco' : 'Account'} onClose={() => setGeneral(null)}>
      {general === 'help' ? <GardenHelp /> : user && <AccountPanel user={user} beforeSignOut={beforeSignOut ?? navigation?.beforeSignOut} />}
    </Sheet>}
  </>;
}

export function useWorkspaceBeforeSignOut(check: () => Promise<string | null>) {
  const register = useWorkspaceNavigation()?.registerBeforeSignOut;
  const latest = useRef(check);
  latest.current = check;
  useLayoutEffect(() => register?.(() => latest.current()), [register]);
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


export function WorkspaceBack({ onBack, children }: { onBack: () => void; children: string }) {
  const navigation = useWorkspaceNavigation();
  return <BackButton label={children} onClick={() => navigation ? navigation.request(onBack) : onBack()} />;
}
export function useGuardedBack(onBack: () => void) {
  const navigation = useWorkspaceNavigation();
  return () => navigation ? navigation.request(onBack) : onBack();
}
