import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../shared/supabase/client';

export function observeAuthSession(onSession: (session: Session | null) => void, onError: () => void) {
  const { auth } = getSupabaseClient();
  let active = true;
  let receivedEvent = false;
  const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
    if (!active) return;
    receivedEvent = true;
    onSession(session);
  });

  // A newer auth event must win over an older session-restore response.
  void auth.getSession().then(({ data, error }) => {
    if (!active || receivedEvent) return;
    if (error) onError();
    else onSession(data.session);
  }).catch(() => { if (active && !receivedEvent) onError(); });

  return () => { active = false; subscription.unsubscribe(); };
}
