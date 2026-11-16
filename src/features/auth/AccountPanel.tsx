import { useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Button } from '../../shared/ui/Button';
import { signOut } from './authService';
import { authErrorMessage } from './authErrors';

type AccountPanelProps = { user: User; beforeSignOut?: () => Promise<string | null> };

export function AccountPanel({ user, beforeSignOut }: AccountPanelProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  async function handleSignOut() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      const problem = await beforeSignOut?.();
      if (problem) { setError(problem); return; }
      await signOut();
    } catch (problem) {
      setError(authErrorMessage(problem));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600 dark:text-stone-400">Signed in as <span className="block break-all font-medium text-stone-900 dark:text-stone-100">{user.email}</span></p>
      <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">Your gardens stay saved when you sign out. Pending changes are saved before signing out.</p>
      <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
      <Button type="button" variant="secondary" disabled={pending} onClick={handleSignOut}>{pending ? 'Signing out…' : 'Sign out'}</Button>
    </div>
  );
}
