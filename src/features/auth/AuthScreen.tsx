import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { authErrorMessage } from './authErrors';
import { signIn, signUp } from './authService';
import { AuthShell } from './AuthShell';

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const submitting = useRef(false);
  const signingUp = mode === 'signup';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    setNotice('');
    if (signingUp && password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      if (signingUp) {
        const result = await signUp(email.trim(), password);
        if (result.needsConfirmation) {
          setMode('signin');
          setPassword('');
          setConfirmation('');
          setNotice('Check your email for a confirmation link, then sign in. If you already have an account, sign in with your password.');
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (problem) {
      setError(authErrorMessage(problem));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  function switchMode() {
    setMode(signingUp ? 'signin' : 'signup');
    setPassword('');
    setConfirmation('');
    setError('');
    setNotice('');
  }

  return (
    <AuthShell title={signingUp ? 'Create your account' : 'Sign in to your garden'}>
      <p role="status" className="text-sm leading-relaxed text-green-800 empty:hidden dark:text-green-300">{notice}</p>
      <form onSubmit={submit} aria-busy={pending} className="space-y-4">
        <TextField id="auth-email" label="Email" type="email" inputMode="email" autoComplete="email"
          autoCapitalize="none" autoCorrect="off" spellCheck={false} required disabled={pending}
          aria-describedby="auth-error" value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField id="auth-password" label="Password" type="password" required disabled={pending}
          autoComplete={signingUp ? 'new-password' : 'current-password'} minLength={signingUp ? 8 : undefined}
          aria-describedby={signingUp ? 'password-help auth-error' : 'auth-error'}
          value={password} onChange={(event) => setPassword(event.target.value)} />
        {signingUp && <>
          <p id="password-help" className="text-xs text-stone-600 dark:text-stone-400">Use at least 8 characters.</p>
          <TextField id="auth-confirmation" label="Confirm password" type="password" autoComplete="new-password"
            required disabled={pending} aria-describedby="auth-error"
            value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </>}
        <p id="auth-error" role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
        <Button type="submit" disabled={pending}>{pending ? 'Please wait…' : signingUp ? 'Create account' : 'Sign in'}</Button>
      </form>
      <Button type="button" variant="secondary" disabled={pending} onClick={switchMode}>
        {signingUp ? 'Already have an account? Sign in' : 'Create an account'}
      </Button>
    </AuthShell>
  );
}
