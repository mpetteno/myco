import { useI18n } from '../../shared/i18n/I18nProvider';
import type { ReactNode } from 'react';
import { Button } from '../../shared/ui/Button';
import { effectiveSpacing } from './catalogue';
import type { Catalogue, CompanionRule, CompanionTarget, PlantFamily, PlantType, Spacing } from './catalogue';

export type CatalogueSection = 'families' | 'plants' | 'companions';
export type CatalogueSelection = PlantFamily | PlantType | CompanionRule;
type CatalogueEntriesProps = { data: Catalogue; section: CatalogueSection; search: string;
  onEdit: (entry: CatalogueSelection) => void };

function Card({ title, notes, children, onEdit }: { title: string; notes: string; children: ReactNode; onEdit?: () => void }) {
  return <li className="space-y-2 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
    <h3 className="break-words font-medium">{title}</h3>
    <div className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">{children}</div>
    {notes && <p className="whitespace-pre-wrap break-words text-sm text-stone-600 dark:text-stone-400">{notes}</p>}
    {onEdit && <Button variant="secondary" onClick={onEdit} aria-label={`Edit ${title}`}>Edit</Button>}
  </li>;
}
function SpacingSummary({ spacing }: { spacing: Spacing }) {
  return <p>Between plants: {spacing.plantSpacingCm === null ? 'not set' : `${spacing.plantSpacingCm} cm`}<br />
    Between rows: {spacing.rowSpacingCm === null ? 'not set' : `${spacing.rowSpacingCm} cm`}</p>;
}

export function CatalogueEntries({ data, section, search, onEdit }: CatalogueEntriesProps) {
  const { t } = useI18n();
  const match = (text: string) => text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const edit = (entry: CatalogueSelection) => data.isAdmin ? () => onEdit(entry) : undefined;
  const targetName = (target: CompanionTarget) => target.kind === 'family'
    ? `${data.families.find((item) => item.id === target.id)?.name ?? 'Unknown family'} (family)`
    : `${data.plants.find((item) => item.id === target.id)?.name ?? 'Unknown plant'} (plant type)`;
  let cards: ReactNode[];
  if (section === 'families') cards = data.families.filter((item) => match(`${item.name} ${item.notes}`)).map((item) =>
    <Card key={item.id} title={item.name} notes={item.notes} onEdit={edit(item)}><SpacingSummary spacing={item} /></Card>);
  else if (section === 'plants') cards = data.plants.filter((item) => match(`${item.name} ${item.notes} ${item.scientificName ?? ''} ${data.families.find((family) => family.id === item.familyId)?.name ?? ''}`)).map((item) =>
    <Card key={item.id} title={item.name} notes={item.notes} onEdit={edit(item)}>
      <p className="mb-1 break-words">Family: {data.families.find((family) => family.id === item.familyId)?.name}</p>
      {item.scientificName && <p>{item.scientificName}</p>}
      {item.livingMulchEnabled && <p>{t('catalogue.livingEligible')}</p>}
      <SpacingSummary spacing={effectiveSpacing(item, data.families)} />
      <p>Minimum border distance: {item.borderDistanceCm} cm</p>
      {(item.plantSpacingCm === null || item.rowSpacingCm === null) && <p className="mt-1 text-xs">Empty plant-type distances use family defaults where available.</p>}
    </Card>);
  else cards = data.rules.filter((item) => match(`${targetName(item.first)} ${targetName(item.second)} ${item.relationship} ${item.notes}`)).map((item) =>
    <Card key={item.id} title={`${targetName(item.first)} + ${targetName(item.second)}`} notes={item.notes} onEdit={edit(item)}>
      <p className={item.relationship === 'companion' ? 'text-green-800 dark:text-green-400' : 'text-amber-800 dark:text-amber-400'}>
        {item.relationship === 'companion' ? 'Companion suggestion' : 'Caution / warning'}</p>
    </Card>);
  return cards.length ? <ul className="space-y-3">{cards}</ul>
    : <p className="text-sm text-stone-600 dark:text-stone-400">{search ? 'No matching entries.' : 'No entries yet.'}</p>;
}
