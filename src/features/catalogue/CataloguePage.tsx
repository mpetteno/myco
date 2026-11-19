import { FieldScope } from '../../shared/ui/FieldScope';
import { useEffect, useRef, useState } from 'react';
import { SeedMixturePanel } from '../seed-mixtures/SeedMixturePanel';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { Button } from '../../shared/ui/Button';
import { EditorScreen } from '../../shared/ui/EditorScreen';
import { ThemeToggle } from '../appearance/ThemeToggle';
import { ReferenceCataloguePanel } from '../catalogue-reference/ReferenceCataloguePanel';
import { loadReferenceData } from '../catalogue-reference/referenceRepository';
import { MulchCataloguePanel } from '../mulch-catalogue/MulchCataloguePanel';
import { PlantCataloguePanel } from './PlantCataloguePanel';
import { WorkspaceNav, WorkspaceNavigation, useWorkspaceNavigation } from '../../shared/navigation/WorkspaceNavigation';
import type { GardenDocument } from '../gardens/gardenDocument';

const groups = [
  { label: 'catalogue.plants', sections: [
    { id: 'plants', label: 'catalogue.crops' },
    { id: 'families', label: 'catalogue.families' },
    { id: 'plant_cultivars', label: 'catalogue.label.cultivars' },
    { id: 'seed_mixtures', label: 'catalogue.seedMixtures' },
  ] },
  { label: 'catalogue.mulch', sections: [
    { id: 'materials', label: 'catalogue.materials' },
    { id: 'mulch_categories', label: 'catalogue.label.mulch_categories', admin: true },
  ] },
] as const;
type Section = typeof groups[number]['sections'][number]['id'];
type Props = { userId: string; onBack: () => void; backLabel?: string; garden?: GardenDocument };

export function CataloguePage(props: Props) {
  const navigation = useWorkspaceNavigation();
  return navigation ? <CatalogueContent {...props} /> : <WorkspaceNavigation destination="catalogue" onNavigate={props.onBack}><CatalogueContent {...props} /></WorkspaceNavigation>;
}
function CatalogueContent({ userId, onBack, backLabel }: Props) {
  const { t } = useI18n();
  const navigation = useWorkspaceNavigation()!;
  const [section, setSection] = useState<Section>('plants');
  const [visited, setVisited] = useState<Section[]>(['plants']);
  const [admin, setAdmin] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const positions = useRef<Partial<Record<Section, number>>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { let alive = true; void loadReferenceData(userId).then((data) => { if (alive) setAdmin(data.isAdmin); }).catch(() => {}); return () => { alive = false; }; }, [userId]);
  const group = groups.find((item) => item.sections.some((item) => item.id === section))!;
  const label = groups.flatMap((item) => [...item.sections]).find((item) => item.id === section)!.label;
  function choose(next: Section) {
    if (next === section) return;
    navigation.request(() => {
      positions.current[section] = scroller.current?.scrollTop ?? 0;
      setVisited((current) => current.includes(next) ? current : [...current, next]); setSection(next);
      requestAnimationFrame(() => { if (scroller.current) scroller.current.scrollTop = positions.current[next] ?? 0; heading.current?.focus({ preventScroll: true }); });
    });
  }
  return <EditorScreen toolbar={null} header={
    <header className="flex shrink-0 items-center gap-3 border-b border-stone-200 bg-white p-3 sm:px-6 dark:border-stone-800 dark:bg-stone-900">
      <div className="max-w-40"><Button variant="secondary" onClick={() => navigation.request(onBack)}>{backLabel ?? t('catalogue.backToGardens')}</Button></div>
      <h1 className="min-w-0 flex-1 text-lg font-semibold">{t('catalogue.title')}</h1><ThemeToggle /><WorkspaceNav />
    </header>
  }>
    <div ref={scroller} data-page-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-4xl space-y-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
        <p className="text-sm text-stone-600 dark:text-stone-400">{t('catalogue.description')}</p>
        <nav aria-label="Catalogue groups" className="grid grid-cols-2 gap-2">{groups.map((item) => <Button key={item.label} variant={item === group ? 'primary' : 'secondary'} aria-current={item === group ? 'page' : undefined} onClick={() => choose(item.sections[0].id)}>{t(item.label)}</Button>)}</nav>
        <nav aria-label="Catalogue sections" className="flex flex-wrap gap-2">{group.sections.filter((item) => !('admin' in item) || admin).map((item) => <button key={item.id} type="button" aria-current={item.id === section ? 'page' : undefined} className={`min-h-11 cursor-pointer rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-green-600 ${item.id === section ? 'bg-stone-200 font-semibold dark:bg-stone-800' : 'underline underline-offset-4'}`} onClick={() => choose(item.id)}>{'admin' in item ? `Configure ${t(item.label).toLowerCase()}` : t(item.label)}</button>)}</nav>
        <h2 ref={heading} tabIndex={-1} id="catalogue-heading" className="text-lg font-semibold focus:outline-none">{t(label)}</h2>
        {visited.map((item) => <FieldScope key={item} prefix={item !== section ? `hidden-${item}-` : ''}><section hidden={item !== section} inert={item !== section} aria-label={t(groups.flatMap((group) => [...group.sections]).find((entry) => entry.id === item)!.label)}>
          {item === 'families' || item === 'plants' ? <PlantCataloguePanel userId={userId} section={item} />
            : item === 'seed_mixtures' ? <SeedMixturePanel userId={userId} />
            : item === 'materials' ? <MulchCataloguePanel userId={userId} />
            : <ReferenceCataloguePanel userId={userId} section={item} />}
        </section></FieldScope>)}
      </div>
    </div>
  </EditorScreen>;
}
