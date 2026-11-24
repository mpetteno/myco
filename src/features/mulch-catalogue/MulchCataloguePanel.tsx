import { CatalogueDescription } from '../catalogue/CatalogueDescription';
import { PlantDetailNavigator } from '../catalogue/PlantDetailNavigator';
import type { PlantDetailTarget } from '../catalogue/PlantDetailNavigator';
import { useDetailScroll } from '../../shared/hooks/useDetailScroll';
import { useWorkspaceNavigation } from '../../shared/navigation/WorkspaceNavigation';
import { CatalogueEntryRow } from '../catalogue/CatalogueEntryRow';
import { CatalogueSiblingNavigation } from '../catalogue/CatalogueSiblingNavigation';
import { CatalogueRemovalDialog } from '../catalogue/CatalogueRemovalDialog';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { isLivingMulch } from './mulchCatalogue';
import type { MulchCatalogue, MulchType } from './mulchCatalogue';
import { loadMulchCatalogue, saveMulchType, removeMulchType } from './mulchCatalogueRepository';
import { mulchCatalogueError } from './mulchCatalogueErrors';
import { MulchTypeForm } from './MulchTypeForm';

export function MulchCataloguePanel({ userId, onEditingChange }: { userId: string; onEditingChange?: (editing: boolean) => void }) {
  const { t } = useI18n();
  const navigation = useWorkspaceNavigation();
  const detailContainer = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<MulchCatalogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ current?: MulchType; sequence?: string[]; formKey: string } | null>(null);
  const [plantDetail, setPlantDetail] = useState<{ target: PlantDetailTarget; siblings: PlantDetailTarget[] }>();
  const [plantEditing, setPlantEditing] = useState(false);
  const [removing, setRemoving] = useState<MulchType | null>(null);
  const [message, setMessage] = useState('');
  const detailScroll = useDetailScroll(!editing && !plantDetail && !loading);
  useEffect(() => {
    const element = detailContainer.current;
    const scroller = element?.closest('[data-page-scroll]');
    if (element && scroller) scroller.scrollTop += element.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    element?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
  }, [editing?.formKey]);
  function backToList() { detailScroll.restore(); setEditing(null); }

  useEffect(() => {
    onEditingChange?.(!!editing || !!removing || plantEditing);
    return () => onEditingChange?.(false);
  }, [editing, removing, plantEditing, onEditingChange]);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setEditing(null); setPlantDetail(undefined); setRemoving(null); setMessage('');
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
    setEditing((current) => ({ ...current, formKey: current?.formKey ?? entry.id, current: entry })); setMessage('Mulch type saved.');
  }
  if (plantDetail) return <PlantDetailNavigator userId={userId} initial={plantDetail.target} siblings={plantDetail.siblings} catalogue={data.plants}
    onEditingChange={setPlantEditing} onBack={() => {
      setLoading(true); detailScroll.restore(); setPlantDetail(undefined); setAttempt((value) => value + 1);
    }} />;
  if (editing) {
    const sequence = editing.sequence ?? [];
    const index = sequence.indexOf(editing.current?.id ?? '');
    const previous = index > 0 ? data.types.find((item) => item.id === sequence[index - 1]) : undefined;
    const next = index >= 0 ? data.types.find((item) => item.id === sequence[index + 1]) : undefined;
    function open(item: MulchType) {
      const action = () => setEditing({ current: item, sequence, formKey: item.id });
      if (navigation) navigation.request(action); else action();
    }
    return <div ref={detailContainer}><MulchTypeForm key={editing.formKey} readOnly={!data.isAdmin} catalogue={data} current={editing.current} onCancel={backToList}
      navigation={editing.current && sequence.length ? <CatalogueSiblingNavigation onPrevious={previous ? () => open(previous) : undefined} onNext={next ? () => open(next) : undefined} /> : undefined}
      onSave={async (details) => saved(await saveMulchType(details, editing.current))} /></div>;
  }
  function plantTarget(item: MulchType): PlantDetailTarget | undefined {
    if (!item.plantTypeId) return undefined;
    return item.cultivarId ? { kind: 'cultivar', id: item.cultivarId, cropId: item.plantTypeId, name: item.name }
      : { kind: 'crop', id: item.plantTypeId, name: item.name };
  }
  const query = search.trim().toLocaleLowerCase();
  const matches = data.types.filter((item) => item.available !== false && `${item.name} ${item.notes}`.toLocaleLowerCase().includes(query));
  const categories = data.categories ?? [];
  const groups = [...categories.map((category) => ({ id: category.id, name: category.name, living: category.code === 'living', items: matches.filter((item) => item.categoryId === category.id) })),
    { id: 'unclassified', name: t('catalogue.unclassified'), living: false, items: matches.filter((item) => !categories.some((category) => category.id === item.categoryId)) }];
  return <div className="space-y-4">
    {data.isAdmin && removing && <CatalogueRemovalDialog key={removing.id} name={removing.name}
      onCancel={() => setRemoving(null)} onRemove={() => removeMulchType(removing)} onRemoved={() => {
        setData((current) => current ? { ...current, types: current.types.filter((item) => item.id !== removing.id) } : current);
        setRemoving(null); setMessage(t('catalogue.removed'));
      }} />}
    <CatalogueDescription isAdmin={data.isAdmin} />
    <TextField id="mulch-catalogue-search" label="Search mulch types" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
    {data.isAdmin && <Button onClick={() => { setEditing({ formKey: 'new' }); setMessage(''); }}>Add mulch type</Button>}
    <p role="status" className="text-sm text-green-800 empty:hidden dark:text-green-400">{message}</p>
    {groups.filter((group) => group.items.length > 0 || group.living).map((group) => <section key={group.id} aria-label={group.name} className="space-y-3">
      <h3 className="font-semibold">{group.name}</h3>
      {group.living && <p className="text-sm text-stone-600 dark:text-stone-400">{t('catalogue.livingManaged')}</p>}
      <ul className="space-y-3">{group.items.map((item) => <CatalogueEntryRow key={item.id} title={item.name} titleLevel={4}
        actions={!isLivingMulch(item, categories) ? <>
          <Button variant="secondary" data-detail-entry={item.id} aria-label={`${data.isAdmin ? 'Edit' : 'View'} ${item.name}`} onClick={() => {
            detailScroll.remember(); setEditing({ current: item, sequence: group.items.map((entry) => entry.id), formKey: item.id }); setMessage('');
          }}>{data.isAdmin ? 'Edit' : 'View'}</Button>
          {data.isAdmin && <Button type="button" variant="danger" aria-label={t('catalogue.removeNamed', { name: item.name })}
            onClick={() => { setRemoving(item); setMessage(''); }}>{t('catalogue.remove')}</Button>}
        </> : plantTarget(item) ? <Button variant="secondary" data-detail-entry={item.id}
          aria-label={t(item.cultivarId ? 'catalogue.openCultivar' : 'catalogue.openCrop', { name: item.name })} onClick={() => {
            const target = plantTarget(item);
            if (!target) return;
            detailScroll.remember();
            setPlantDetail({ target, siblings: group.items.map(plantTarget).filter((entry): entry is PlantDetailTarget => !!entry) });
          }}>{t('catalogue.viewPlant')}</Button> : undefined} />)}</ul>
      {group.living && !group.items.length && <p className="text-sm">{t(query ? 'catalogue.noMatchingLiving' : 'catalogue.noLivingPlants')}</p>}
    </section>)}
    {!matches.length && <p className="text-sm text-stone-600 dark:text-stone-400">{query ? 'No matching mulch types.' : 'No mulch types yet.'}</p>}
    <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>Refresh catalogue</Button>
  </div>;
}
