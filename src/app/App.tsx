import { GardensWorkspace } from '../features/gardens/GardensWorkspace';
import { AuthScreen } from '../features/auth/AuthScreen';
import { AuthShell } from '../features/auth/AuthShell';
import { useAuthSession } from '../features/auth/useAuthSession';
import { Button } from '../shared/ui/Button';

export function App() {
  const auth = useAuthSession();
  if (auth.loading) return <AuthShell title="Welcome to Myco"><p role="status" className="text-sm text-stone-600 dark:text-stone-400">Checking your session…</p></AuthShell>;
  if (auth.error) return (
    <AuthShell title="Unable to load your session">
      <p role="alert" className="text-sm text-red-700 dark:text-red-400">The account service is unavailable. Check your connection and try again.</p>
      <Button type="button" onClick={auth.retry}>Try again</Button>
    </AuthShell>
  );
  if (!auth.session) return <AuthScreen />;
  return <GardensWorkspace key={auth.session.user.id} user={auth.session.user} />;
}
