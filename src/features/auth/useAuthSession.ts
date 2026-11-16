import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { observeAuthSession } from './authSession';

type AuthState = { session: Session | null; loading: boolean; error: boolean };

export function useAuthSession() {
  const [state, setState] = useState<AuthState>({ session: null, loading: true, error: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setState({ session: null, loading: true, error: false });
    const fail = () => setState({ session: null, loading: false, error: true });
    try {
      return observeAuthSession((session) => setState({ session, loading: false, error: false }), fail);
    } catch {
      fail();
    }
  }, [attempt]);

  return { ...state, retry: () => setAttempt((value) => value + 1) };
}
