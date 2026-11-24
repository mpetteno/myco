import { useCallback, useEffect, useRef, useState } from 'react';
import { WorkspaceNavigation, useWorkspaceNavigation } from '../../shared/navigation/WorkspaceNavigation';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { Button } from '../../shared/ui/Button';
import { CatalogueSiblingNavigation } from './CatalogueSiblingNavigation';
import { CatalogueBack } from './CatalogueBack';
import { CropGuidancePanel } from './CropGuidancePanel';
import { PlantEntryForm } from './PlantEntryForm';
import { loadCatalogue, saveFamily } from './catalogueRepository';
import { catalogueError } from './catalogueErrors';
import type { Catalogue, PlantFamily } from './catalogue';

export type PlantDetailTarget = { kind: 'family' | 'crop'; id: string; name: string }
  | { kind: 'cultivar'; id: string; cropId: string; name: string };
type Props = { userId: string; initial: PlantDetailTarget; siblings: PlantDetailTarget[]; catalogue?: Catalogue;
  onBack: () => void; onEditingChange?: (editing: boolean) => void };
const familyTargets = (data: Catalogue): PlantDetailTarget[] => data.families.map((family) => ({ kind: 'family', id: family.id, name: family.name }));
const cropTargets = (data: Catalogue, familyId: string): PlantDetailTarget[] => data.plants.filter((crop) => crop.familyId === familyId).map((crop) => ({ kind: 'crop', id: crop.id, name: crop.name }));
const cultivarTargets = (data: Catalogue, cropId: string): PlantDetailTarget[] => (data.cultivars ?? []).filter((cultivar) => cultivar.plantTypeId === cropId).map((cultivar) => ({ kind: 'cultivar', id: cultivar.id, cropId, name: cultivar.name }));

// Detail navigation owns only the current browsing sequence; the originating list stays mounted.
export function PlantDetailNavigator(props: Props) {
  const navigation = useWorkspaceNavigation();
  return navigation ? <PlantDetailContent {...props} />
    : <WorkspaceNavigation destination="catalogue" onNavigate={props.onBack}><PlantDetailContent {...props} /></WorkspaceNavigation>;
}
function PlantDetailContent({ userId, initial, siblings: initialSiblings, catalogue: initialCatalogue, onBack, onEditingChange }: Props) {
  const { t } = useI18n();
  const navigation = useWorkspaceNavigation();
  const [target, setTarget] = useState(initial);
  const [siblings, setSiblings] = useState(initialSiblings);
  const [catalogue, setCatalogue] = useState(initialCatalogue);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (target.kind !== 'family' || catalogue) return;
    let alive = true;
    void loadCatalogue(userId).then((data) => { if (alive) setCatalogue(data); })
      .catch((problem) => { if (alive) setError(catalogueError(problem).message); });
    return () => { alive = false; };
  }, [target.kind, catalogue, userId, attempt]);
  const reveal = useCallback(() => {
    const element = container.current;
    const scroller = element?.closest('[data-page-scroll]');
    if (element && scroller) scroller.scrollTop += element.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    const heading = element?.querySelector<HTMLElement>('h3');
    heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true });
  }, []);
  useEffect(reveal, [target.kind, target.id, reveal]);

  function open(next: PlantDetailTarget, sequence: PlantDetailTarget[], data: Catalogue) {
    const action = () => {
      setTarget(next); setSiblings(sequence);
      // A Save-and-leave action was created before the save finished. Retain its newer family revisions.
      setCatalogue((current) => ({ ...data, families: data.families.map((family) => {
        const saved = current?.families.find((item) => item.id === family.id);
        return saved && saved.version > family.version ? saved : family;
      }) }));
      setError('');
    };
    if (navigation) navigation.request(action); else action();
  }
  function links(data: Catalogue) {
    const crop = data.plants.find((item) => item.id === (target.kind === 'cultivar' ? target.cropId : target.id));
    const family = data.families.find((item) => item.id === (target.kind === 'family' ? target.id : crop?.familyId));
    const index = siblings.findIndex((item) => item.kind === target.kind && item.id === target.id);
    const previous = index > 0 ? siblings[index - 1] : undefined;
    const next = index >= 0 ? siblings[index + 1] : undefined;
    const children = target.kind === 'family' ? cropTargets(data, target.id) : target.kind === 'crop' ? cultivarTargets(data, target.id) : [];
    return <div className="space-y-3">
      <CatalogueSiblingNavigation onPrevious={previous ? () => open(previous, siblings, data) : undefined}
        onNext={next ? () => open(next, siblings, data) : undefined} />
      <nav aria-label={t('catalogue.relatedEntries')} className="space-y-2">
        {target.kind !== 'family' && family && <Button type="button" variant="secondary" aria-label={t('catalogue.openFamily', { name: family.name })}
          onClick={() => open({ kind: 'family', id: family.id, name: family.name }, familyTargets(data), data)}>{t('catalogue.parentFamily', { name: family.name })}</Button>}
        {target.kind === 'cultivar' && crop && <Button type="button" variant="secondary" aria-label={t('catalogue.openCrop', { name: crop.name })}
          onClick={() => open({ kind: 'crop', id: crop.id, name: crop.name }, cropTargets(data, crop.familyId), data)}>{t('catalogue.parentCrop', { name: crop.name })}</Button>}
        {target.kind !== 'cultivar' && <details>
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">{t(target.kind === 'family' ? 'catalogue.relatedCrops' : 'catalogue.relatedCultivars', { count: children.length })}</summary>
          {children.length ? <ul className="space-y-2">{children.map((child) => <li key={child.id}><Button type="button" variant="secondary"
            aria-label={t(child.kind === 'crop' ? 'catalogue.openCrop' : 'catalogue.openCultivar', { name: child.name })}
            onClick={() => open(child, children, data)}>{child.name}</Button></li>)}</ul>
            : <p className="text-sm text-stone-600 dark:text-stone-400">{t(target.kind === 'family' ? 'catalogue.noRelatedCrops' : 'catalogue.noRelatedCultivars')}</p>}
        </details>}
      </nav>
    </div>;
  }
  const key = `${target.kind}:${target.id}`;
  if (target.kind !== 'family') return <div ref={container}><CropGuidancePanel key={key} userId={userId}
    cropId={target.kind === 'cultivar' ? target.cropId : target.id} cultivarId={target.kind === 'cultivar' ? target.id : undefined}
    name={target.name} onBack={onBack} onEditingChange={onEditingChange} navigation={links} onReady={reveal} /></div>;
  const family = catalogue?.families.find((item) => item.id === target.id);
  return <div ref={container}>
    {catalogue && family ? <PlantEntryForm key={key} kind="family" families={catalogue.families} current={family} readOnly={!catalogue.isAdmin}
      onCancel={onBack} navigation={links(catalogue)} onSave={async (details) => {
        const saved = await saveFamily(details, family);
        setCatalogue((current) => current && ({ ...current, families: current.families.map((item) => item.id === saved.id ? saved as PlantFamily : item) }));
      }} /> : <div className="space-y-3"><CatalogueBack onBack={onBack} /><p role={error || catalogue ? 'alert' : 'status'}>{error || (catalogue ? t('catalogue.entryUnavailable') : t('catalogue.loadingReference'))}</p>
      {error && <Button variant="secondary" onClick={() => { setError(''); setAttempt((value) => value + 1); }}>{t('catalogue.refresh')}</Button>}</div>}
  </div>;
}
