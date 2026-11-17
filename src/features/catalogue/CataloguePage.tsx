import { SeedMixturePanel } from '../seed-mixtures/SeedMixturePanel';
import { useState } from 'react';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { Button } from '../../shared/ui/Button';
import { EditorScreen } from '../../shared/ui/EditorScreen';
import { SelectField } from '../../shared/ui/SelectField';
import { ThemeToggle } from '../appearance/ThemeToggle';
import { ReferenceCataloguePanel } from '../catalogue-reference/ReferenceCataloguePanel';
import { MulchCataloguePanel } from '../mulch-catalogue/MulchCataloguePanel';
import { PlantCataloguePanel } from './PlantCataloguePanel';

const groups = [
  { label: 'catalogue.plants', sections: [
    { id: 'families', label: 'catalogue.families' },
    { id: 'plants', label: 'catalogue.crops' },
    { id: 'plant_cultivars', label: 'catalogue.label.cultivars' },
    { id: 'seed_mixtures', label: 'catalogue.seedMixtures' },
    { id: 'plant_guidance', label: 'catalogue.label.care_guidance' },
    { id: 'plant_depths', label: 'catalogue.label.planting_depths' },
    { id: 'companions', label: 'catalogue.companions' },
    { id: 'rotation_rules', label: 'catalogue.label.rotation_rules' },
  ] },
  { label: 'catalogue.calendar', sections: [
    { id: 'calendar_profiles', label: 'catalogue.label.calendars' },
    { id: 'calendar_coverage', label: 'catalogue.label.calendar_coverage' },
    { id: 'plant_calendar_entries', label: 'catalogue.label.growing_calendar' },
  ] },
  { label: 'catalogue.mulch', sections: [
    { id: 'materials', label: 'catalogue.materials' },
    { id: 'mulch_categories', label: 'catalogue.label.mulch_categories' },
  ] },
] as const;
type Section = typeof groups[number]['sections'][number]['id'];

export function CataloguePage({ userId, onBack }: { userId: string; onBack: () => void }) {
  const { t } = useI18n();
  const [section, setSection] = useState<Section>('plants');
  const [editing, setEditing] = useState(false);
  const label = groups.flatMap((group) => [...group.sections]).find((item) => item.id === section)!.label;
  return <EditorScreen toolbar={null} header={
    <header className="flex shrink-0 items-center gap-3 border-b border-stone-200 bg-white p-3 sm:px-6 dark:border-stone-800 dark:bg-stone-900">
      <div className="max-w-40"><Button variant="secondary" disabled={editing} onClick={onBack}>{t('catalogue.backToGardens')}</Button></div>
      <h1 className="min-w-0 flex-1 text-lg font-semibold">{t('catalogue.title')}</h1>
      <ThemeToggle />
    </header>
  }>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-3xl space-y-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
        <p className="text-sm text-stone-600 dark:text-stone-400">{t('catalogue.description')}</p>
        <SelectField id="catalogue-section" label={t('catalogue.pageSection')} value={section} disabled={editing}
          onChange={(event) => setSection(event.target.value as Section)}>
          {groups.map((group) => <optgroup key={group.label} label={t(group.label)}>
            {group.sections.map((item) => <option key={item.id} value={item.id}>{t(item.label)}</option>)}
          </optgroup>)}
        </SelectField>
        {editing && <p role="status" className="text-sm">{t('catalogue.finishEdit')}</p>}
        <section aria-labelledby="catalogue-heading" className="space-y-4">
          <h2 id="catalogue-heading" className="text-lg font-semibold">{t(label)}</h2>
          {section === 'families' || section === 'plants' || section === 'companions'
            ? <PlantCataloguePanel key={section} userId={userId} section={section} onEditingChange={setEditing} />
            : section === 'seed_mixtures'
              ? <SeedMixturePanel userId={userId} onEditingChange={setEditing} />
            : section === 'materials'
              ? <MulchCataloguePanel userId={userId} onEditingChange={setEditing} />
              : <ReferenceCataloguePanel key={section} userId={userId} section={section} onEditingChange={setEditing} />}
        </section>
      </div>
    </div>
  </EditorScreen>;
}
