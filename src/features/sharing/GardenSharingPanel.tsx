import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { gardenStorageError } from '../gardens/gardenErrors';
import { listGardenMembers, shareGarden, unshareGarden } from './sharingRepository';
import type { GardenMember } from './sharingRepository';

type GardenSharingPanelProps = { gardenId: string; isOwner: boolean };

export function GardenSharingPanel({ gardenId, isOwner }: GardenSharingPanelProps) {
  const [members, setMembers] = useState<GardenMember[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (!isOwner) return;
    let alive = true;
    setLoading(true); setLoaded(false); setError('');
    void listGardenMembers(gardenId).then((list) => { if (alive) { setMembers(list); setLoaded(true); } })
      .catch((problem) => { if (alive) setError(gardenStorageError(problem).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [gardenId, isOwner, attempt]);

  async function change(action: () => Promise<void>, success: string) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(''); setMessage('');
    try {
      await action();
      setLoaded(false);
      setMessage(success);
      setMembers(await listGardenMembers(gardenId));
      setLoaded(true);
    } catch (problem) { setError(gardenStorageError(problem).message); }
    finally { busy.current = false; setPending(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void change(async () => { await shareGarden(gardenId, email); setEmail(''); }, 'Editor added. They can open this garden from their garden list.');
  }

  if (!isOwner) return <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">You can edit this shared garden, including its name, dimensions and beds. Only the owner can add or remove people.</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">Everyone with access can edit the garden. As the owner, only you can add or remove editors. Sharing grants access immediately and sends no email.</p>
      <form onSubmit={submit} className="space-y-3">
        <TextField id="share-email" label="Editor’s email" type="email" autoCapitalize="none" autoCorrect="off"
          required value={email} disabled={pending || loading || !loaded} onChange={(event) => setEmail(event.target.value)} />
        <p className="text-xs text-stone-600 dark:text-stone-400">They need an existing account with a confirmed email.</p>
        <Button type="submit" disabled={pending || loading || !loaded}>{pending ? 'Updating…' : 'Add editor'}</Button>
      </form>
      <p role="status" className="text-sm text-green-800 empty:hidden dark:text-green-400">{message}</p>
      <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
      {error && <Button variant="secondary" disabled={pending || loading} onClick={() => setAttempt((value) => value + 1)}>Refresh access list</Button>}
      {loading && <p role="status" className="text-sm">Loading editors…</p>}
      {loaded && <>
        <h3 className="font-medium">Editors ({members.length})</h3>
        {members.length === 0 && <p className="text-sm text-stone-600 dark:text-stone-400">This garden is currently private.</p>}
        <ul className="space-y-2">
          {members.map((member) => <li key={member.userId} className="flex items-center gap-3 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
            <span className="min-w-0 flex-1 break-all text-sm">{member.email}</span>
            <div className="shrink-0"><Button variant="secondary" disabled={pending} onClick={() => void change(() => unshareGarden(gardenId, member.userId), 'Access removed.')}
              aria-label={`Remove access for ${member.email}`}>Remove</Button></div>
          </li>)}
        </ul>
      </>}
    </div>
  );
}
