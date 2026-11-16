import { useI18n } from '../../shared/i18n/I18nProvider';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { SelectField } from '../../shared/ui/SelectField';
import { dayKey } from '../history/gardenHistory';
import { historyError } from '../history/historyRepository';
import type { Bed } from '../beds/bed';
import { validateActivity } from './activities';
import type { ActivityDetails } from './activities';

export function ActivityForm({ beds, bedId, onSave, onCancel, onReload }: { beds: Bed[]; bedId?: string;
  onSave: (details: ActivityDetails,id: string) => Promise<void>; onCancel: () => void; onReload: () => Promise<void> }) {
  const { t } = useI18n();
  const [details,setDetails] = useState<ActivityDetails>({ bedId:bedId ?? beds[0]?.id ?? '', date:dayKey(), title:'', notes:'' });
  const [confirmed,setConfirmed] = useState(false), [pending,setPending] = useState(false),[error,setError] = useState('');
  const [conflict,setConflict] = useState(false);
  const busy = useRef(false), request = useRef({ key:'',id:'' });
  function change(values: Partial<ActivityDetails>) { setDetails((current) => ({ ...current,...values })); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return;
    const problem = validateActivity(details, t) ?? (!confirmed ? t('record.confirmBedRequired') : null);
    if (problem) { setError(problem); return; }
    const key = JSON.stringify(details);
    if (request.current.key !== key) request.current = { key,id:crypto.randomUUID() };
    busy.current = true; setPending(true); setError('');
    try { await onSave(details,request.current.id); }
    catch (problem) { const error=historyError(problem);setError(error.translationKey ? t(error.translationKey) : error.message);setConflict(error.conflict); }
    finally { busy.current = false; setPending(false); }
  }
  async function reload() {
    setPending(true);
    try { await onReload(); }
    catch (problem) { const error = historyError(problem); setError(error.translationKey ? t(error.translationKey) : error.message); }
    finally { setPending(false); }
  }
  return <form className="space-y-4" onSubmit={submit}>
    <h3 className="font-semibold">{t('record.bed')}</h3>
    <p className="text-sm text-stone-600 dark:text-stone-400">{t('record.bedDescription')}</p>
    <SelectField id="activity-bed" label={t('record.bedLabel')} value={details.bedId} disabled={pending || !!bedId} onChange={(event) => change({ bedId:event.target.value })}>
      {!beds.some((bed) => bed.id === details.bedId) && <option value={details.bedId}>{t('record.missingBed')}</option>}
      {beds.map((bed) => <option key={bed.id} value={bed.id}>{bed.name}</option>)}
    </SelectField>
    <TextField id="activity-date" label={t('record.completionDate')} type="date" required value={details.date} disabled={pending} onChange={(event) => change({ date:event.target.value })} />
    <TextField id="activity-title" label={t('record.title')} required maxLength={120} value={details.title} disabled={pending} onChange={(event) => change({ title:event.target.value })} />
    <TextField id="activity-notes" label={t('record.completionNotes')} maxLength={2000} value={details.notes} disabled={pending} onChange={(event) => change({ notes:event.target.value })} />
    <label className="flex min-h-12 items-center gap-3 text-sm"><input id="activity-confirm" type="checkbox" checked={confirmed} disabled={pending} onChange={(event) => setConfirmed(event.target.checked)} className="h-5 w-5 shrink-0 accent-green-700" />{t('record.confirmBed')}</label>
    <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
    {conflict && <Button type="button" variant="secondary" disabled={pending} onClick={() => void reload()}>{t('record.reload')}</Button>}
    <Button type="submit" disabled={pending}>{pending ? t('record.recording') : t('record.bed')}</Button>
    <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>{t('record.back')}</Button>
  </form>;
}
