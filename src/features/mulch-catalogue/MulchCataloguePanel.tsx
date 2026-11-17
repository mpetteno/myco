import { CatalogueRemovalDialog } from '../catalogue/CatalogueRemovalDialog';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { useEffect, useState } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import type { MulchCatalogue, MulchType } from './mulchCatalogue';
import { loadMulchCatalogue, saveMulchType, removeMulchType } from './mulchCatalogueRepository';
import { mulchCatalogueError } from './mulchCatalogueErrors';
import { MulchTypeForm } from './MulchTypeForm';

export function MulchCataloguePanel({ userId, onEditingChange }: { userId: string; onEditingChange?: (editing: boolean) => void }) {
  const { t } = useI18n();
  const [data, setData] = useState<MulchCatalogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ current?: MulchType } | null>(null);
  const [removing, setRemoving] = useState<MulchType | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    onEditingChange?.(!!editing || !!removing);
    return () => onEditingChange?.(false);
  }, [editing, removing, onEditingChange]);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setEditing(null); setRemoving(null); setMessage('');
    void loadMulchCatalogue(userId).then((next) => { if (alive) setData(next); })
      .catch((problem) => { if (alive) setError(mulchCatalogueError(problem).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId, attempt]);
  if (loading) return <p role="status" className="text-sm">Loading mulch catalogue…</p>;
  if (error || !data) return <div className="space-y-3">
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>
    <Button onClick={() => setAttempt((value) => value + 1)}>Try again</Button>
  </div>;
  function saved(entry: MulchType) {
    setData((current) => {
      if (!current) return current;
      const types = current.types.some((item) => item.id === entry.id)
        ? current.types.map((item) => item.id === entry.id ? entry : item) : [...current.types, entry];
      return { ...current, types: types.sort((a, b) => a.name.localeCompare(b.name)) };
    });
    setEditing(null); setMessage('Mulch type saved.');
  }
  if (editing && data.isAdmin) return <MulchTypeForm catalogue={data} current={editing.current} onCancel={() => setEditing(null)}
    onSave={async (details) => saved(await saveMulchType(details, editing.current))} />;
  const query = search.trim().toLocaleLowerCase();
  const matches = data.types.filter((item) => `${item.name} ${item.notes}`.toLocaleLowerCase().includes(query));
  return <div className="space-y-4">
    {data.isAdmin && removing && <CatalogueRemovalDialog key={removing.id} name={removing.name}
      onCancel={() => setRemoving(null)} onRemove={() => removeMulchType(removing)} onRemoved={() => {
        setData((current) => current ? { ...current, types: current.types.filter((item) => item.id !== removing.id) } : current);
        setRemoving(null); setMessage(t('catalogue.removed'));
      }} />}
    <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">An app-wide catalogue of mulch materials. {data.isAdmin ? 'You are a catalogue administrator and can add or edit types.' : 'Catalogue administrators manage these types.'}</p>
    <TextField id="mulch-catalogue-search" label="Search mulch types" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
    {data.isAdmin && <Button onClick={() => { setEditing({}); setMessage(''); }}>Add mulch type</Button>}
    <p role="status" className="text-sm text-green-800 empty:hidden dark:text-green-400">{message}</p>
    {matches.length ? <ul className="space-y-3">{matches.map((item) => <li key={item.id} className="space-y-2 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
      <h3 className="break-words font-medium">{item.name}</h3>
      <p className="text-sm">{data.categories?.find((category) => category.id === item.categoryId)?.name ?? t('catalogue.unclassified')}</p>
      {item.notes && <p className="whitespace-pre-wrap break-words text-sm text-stone-600 dark:text-stone-400">{item.notes}</p>}
      {data.isAdmin && <Button variant="secondary" aria-label={`Edit ${item.name}`} onClick={() => { setEditing({ current: item }); setMessage(''); }}>Edit</Button>}
      {data.isAdmin && <Button type="button" variant="danger" aria-label={t('catalogue.removeNamed', { name: item.name })}
        onClick={() => { setRemoving(item); setMessage(''); }}>{t('catalogue.remove')}</Button>}
    </li>)}</ul> : <p className="text-sm text-stone-600 dark:text-stone-400">{query ? 'No matching mulch types.' : 'No mulch types yet.'}</p>}
    <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>Refresh catalogue</Button>
  </div>;
}
