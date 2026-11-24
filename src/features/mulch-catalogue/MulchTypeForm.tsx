import { CatalogueBack } from '../catalogue/CatalogueBack';
import { useFormLeave } from '../../shared/navigation/WorkspaceNavigation';
import { SelectField } from '../../shared/ui/SelectField';
import { useI18n } from '../../shared/i18n/I18nProvider';
import type { MulchCatalogue } from './mulchCatalogue';
import { useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { validateMulchDetails } from './mulchCatalogue';
import type { MulchDetails, MulchType } from './mulchCatalogue';
import { mulchCatalogueError } from './mulchCatalogueErrors';

type MulchTypeFormProps = { catalogue: MulchCatalogue; current?: MulchType; onSave: (details: MulchDetails) => Promise<void>; onCancel: () => void; readOnly?: boolean; navigation?: ReactNode };

export function MulchTypeForm({ catalogue, current, onSave, onCancel, readOnly = false, navigation }: MulchTypeFormProps) {
  const { t } = useI18n();
  const [categoryId, setCategoryId] = useState(current?.categoryId ?? '');
  const [name, setName] = useState(current?.name ?? '');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  const [originalFields, setOriginalFields] = useState(() => JSON.stringify([name,notes,categoryId]));
  const formRef = useFormLeave(!readOnly && JSON.stringify([name,notes,categoryId]) !== originalFields, pending, submit, onCancel);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || readOnly) return;
    const details = { name, notes, categoryId: categoryId || null, plantTypeId: null, cultivarId: null };
    const problem = validateMulchDetails(details);
    if (problem) { setError(problem); return; }
    busy.current = true; setPending(true); setError('');
    try { await onSave(details); setOriginalFields(JSON.stringify([name,notes,categoryId])); setMessage('Catalogue saved.'); return true; }
    catch (problem) { setError(mulchCatalogueError(problem).message); }
    finally { busy.current = false; setPending(false); }
  }
  return <form ref={formRef} onSubmit={submit} className="space-y-4">
    <CatalogueBack onBack={onCancel} disabled={pending} />
    <h3 tabIndex={-1} className="font-semibold focus:outline-none">{current?.name ?? (readOnly ? 'Mulch material' : 'Add mulch type')}</h3>
    {navigation && <fieldset disabled={pending}>{navigation}</fieldset>}
    <TextField id="mulch-type-name" label="Name" required maxLength={100} value={name} disabled={pending || readOnly} onChange={(event) => setName(event.target.value)} />
    <SelectField id="mulch-category" label={t('catalogue.category')} value={categoryId} required={!current || !!current.categoryId} disabled={pending || readOnly} onChange={(e) => setCategoryId(e.target.value)}>
      <option value="">{t('catalogue.unclassified')}</option>
      {catalogue.categories?.filter((category) => category.code !== 'living').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </SelectField>
    <TextField id="mulch-type-notes" label="Notes (optional)" maxLength={2000} value={notes} disabled={pending || readOnly} onChange={(event) => setNotes(event.target.value)} />
    <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
    <p role="status" className="text-sm empty:hidden">{message}</p>
    {!readOnly && <Button type="submit" disabled={pending || readOnly}>{pending ? 'Saving…' : 'Save mulch type'}</Button>}
  </form>;
}
