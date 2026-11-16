import { getSupabaseClient } from '../../shared/supabase/client';

export async function signIn(email: string, password: string) {
  const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email, password,
    options: { emailRedirectTo: new URL(window.location.pathname, window.location.origin).href },
  });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
  if (error) throw error;
}
