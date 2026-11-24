import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import { GardenPage } from '../garden/GardenPage';
import type { SavedGarden } from '../gardens/gardenDocument';
import { Button } from '../../shared/ui/Button';
import { Sheet } from '../../shared/ui/Sheet';
import { PageHeader } from '../../shared/ui/PageHeader';
import { TextField } from '../../shared/ui/TextField';
import { useVisualViewport } from '../../shared/hooks/useVisualViewport';
import type { GardenEventSnapshot } from './gardenHistory';
import type { HistoryDraft, HistoryDraftBridge } from './historyDraft';
import { historyDocument } from './historyDraft';
import { saveHistoricalEvent } from './historyEditingRepository';
import { historyError } from './historyRepository';

export function HistoryEditPage({ draft, current, user, onBack, onSaved, onReload }: { draft: HistoryDraft; current: SavedGarden; user: User;
  onBack: () => void; onReload: () => Promise<void>; onSaved: (event: GardenEventSnapshot) => void }) {
  const [document, setDocument] = useState(draft.document), [details, setDetails] = useState(draft.details);
  const [form, setForm] = useState(false), [discard, setDiscard] = useState(false), [valid, setValid] = useState(true);
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [conflict, setConflict] = useState(false);
  const bridge = useRef<HistoryDraftBridge>(null), busy = useRef(false);
  const [eventId] = useState(() => draft.event?.id ?? crypto.randomUUID());
  const request = useRef({ key: '', id: '' });
  const viewport = useVisualViewport();
  const dirty = !valid || JSON.stringify(document) !== JSON.stringify(draft.document) || JSON.stringify(details) !== JSON.stringify(draft.details);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function back() {
    const problem = await bridge.current?.beforeLeaving();
    if (problem) { setError(problem); setForm(true); return; }
    const changed = bridge.current && JSON.stringify(historyDocument(bridge.current.getCurrent())) !== JSON.stringify(draft.document);
    if (dirty || changed) setDiscard(true); else onBack();
  }
  async function reload() {
    if (busy.current) return;
    busy.current = true; setPending(true);
    try { await onReload(); } catch (problem) { setError(historyError(problem).message); }
    finally { busy.current = false; setPending(false); }
  }
  async function review() {
    if (!valid || busy.current || !bridge.current) return;
    const problem = await bridge.current.beforeLeaving();
    if (problem) { setError(problem); return; }
    setDocument(historyDocument(bridge.current.getCurrent())); setForm(true);
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return;
    const key = JSON.stringify([document, details]);
    if (request.current.key !== key) request.current = { key, id: crypto.randomUUID() };
    busy.current = true; setPending(true); setError('');
    try { onSaved(await saveHistoricalEvent(current.id, draft, document, details, eventId, request.current.id)); }
    catch (problem) { const error = historyError(problem); setError(error.message); setConflict(error.conflict); }
    finally { busy.current = false; setPending(false); }
  }
  const style = { height: viewport.heightPx, '--editor-height': `calc(${viewport.heightPx}px - 4.5rem - env(safe-area-inset-top))`, '--editor-safe-top': '0px' } as CSSProperties;
  return <div style={style} className="overflow-hidden bg-stone-50 pt-[env(safe-area-inset-top)] font-sans text-stone-900 dark:bg-stone-950 dark:text-stone-100">
    <PageHeader tone="draft" headingAs="h2" title={draft.event ? 'Correct history record' : draft.bedId ? 'New past bed edit' : 'New past garden edit'}
      subtitle={`Draft · ${details.date} · later records and current plan stay unchanged`}
      back={{ label: 'Back to history', disabled: pending, onClick: () => void back() }}
      actions={<Button disabled={!valid || pending} onClick={() => void review()}>Save history record</Button>} />
    <GardenPage garden={{ ...current, ...draft.document }} user={user} historyDraft={{ bedId: draft.bedId, bridge, onValidityChange: setValid }}
      onSaved={(next) => setDocument(historyDocument(next))} pickerOpen={form || discard} onChooseGardens={() => {}} onReload={async () => {}} onDiscardChanges={() => {}} />
    {form && <Sheet title={draft.event ? 'Save corrected record' : 'Add historical record'} dismissible={!pending} onClose={() => setForm(false)}>
      <form onSubmit={save} className="space-y-4">
        {draft.basis && <p className="text-sm text-stone-600 dark:text-stone-400">{draft.basis}</p>}
        <p className="text-sm text-stone-600 dark:text-stone-400">This saves only this historical state. Later records and the current plan stay unchanged.</p>
        <TextField id="history-edit-date" label="Record date" type="date" required min="0001-01-01" max="9999-12-31" value={details.date} disabled={pending} onChange={(event) => setDetails({ ...details, date: event.target.value })} />
        <TextField id="history-edit-title" label="Title" required maxLength={120} value={details.title} disabled={pending} onChange={(event) => setDetails({ ...details, title: event.target.value })} />
        <TextField id="history-edit-notes" label="Notes (optional)" maxLength={2000} value={details.notes} disabled={pending} onChange={(event) => setDetails({ ...details, notes: event.target.value })} />
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error} Your historical draft is still here.</p>}
        {conflict && draft.event && <Button type="button" variant="secondary" disabled={pending} onClick={() => void reload()}>Reload record and discard draft</Button>}
        <Button type="submit" disabled={pending}>{pending ? 'Saving history…' : 'Save record'}</Button>
      </form>
    </Sheet>}
    {discard && <Sheet title="Discard historical draft?" onClose={() => setDiscard(false)}><div className="space-y-3">
      <p className="text-sm">These changes have not been recorded.</p>
      <Button variant="danger" onClick={onBack}>Discard historical draft</Button>
      <Button variant="secondary" onClick={() => setDiscard(false)}>Keep editing history</Button>
    </div></Sheet>}
  </div>;
}
