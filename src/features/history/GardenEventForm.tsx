import { useI18n } from '../../shared/i18n/I18nProvider';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { dayKey, validateEventDetails } from './gardenHistory';
import type { GardenEventDetails } from './gardenHistory';
import { historyError } from './historyRepository';

export function GardenEventForm({ latestDate, onSave, onCancel, onReload }: { latestDate?: string;
  onSave: (details: GardenEventDetails, requestId: string) => Promise<void>; onCancel: () => void; onReload: () => Promise<void> }) {
  const { t } = useI18n();
  const [date, setDate] = useState(dayKey), [title, setTitle] = useState(() => t('record.defaultGardenTitle')), [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const busy = useRef(false), request = useRef<{ key: string; id: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const details = { date, title, notes }, problem = validateEventDetails(details, t);
    if (problem) { setError(problem); return; }
    const key = JSON.stringify(details);
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    busy.current = true; setPending(true); setError('');
    try { await onSave(details, request.current.id); }
    catch (problem) { const error = historyError(problem); setError(error.translationKey ? t(error.translationKey) : error.message); setConflict(error.conflict); }
    finally { busy.current = false; setPending(false); }
  }
  async function reload() {
    setPending(true);
    try { await onReload(); }
    catch (problem) { const error = historyError(problem); setError(error.translationKey ? t(error.translationKey) : error.message); }
    finally { setPending(false); }
  }
  return <form className="space-y-4" onSubmit={submit}>
    <h3 className="font-semibold">{t('record.garden')}</h3>
    <p className="text-sm text-stone-600 dark:text-stone-400">{t('record.gardenDescription', { bedAction: t('record.bed') })}</p>
    <TextField id="event-date" label={t('record.eventDate')} type="date" required min="0001-01-01" max="9999-12-31" value={date} disabled={pending} onChange={(event) => setDate(event.target.value)} />
    {latestDate && date < latestDate && <p className="text-sm text-amber-800 dark:text-amber-400">{t('record.backdated')}</p>}
    <TextField id="event-title" label={t('record.eventTitle')} required maxLength={120} value={title} disabled={pending} onChange={(event) => setTitle(event.target.value)} />
    <TextField id="event-notes" label={t('record.notes')} maxLength={2000} value={notes} disabled={pending} onChange={(event) => setNotes(event.target.value)} />
    <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
    {conflict && <Button type="button" variant="secondary" disabled={pending} onClick={() => void reload()}>{t('record.reload')}</Button>}
    <Button type="submit" disabled={pending}>{pending ? t('record.recording') : t('record.garden')}</Button>
    <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>{t('record.back')}</Button>
  </form>;
}
