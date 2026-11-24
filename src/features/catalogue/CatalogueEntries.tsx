import { useI18n } from '../../shared/i18n/I18nProvider';
import { CatalogueEntryRow } from './CatalogueEntryRow';
import type { ReactNode } from 'react';
import { Button } from '../../shared/ui/Button';
import type { Catalogue, CompanionRule, CompanionTarget, PlantFamily, PlantType } from './catalogue';

export type CatalogueSection = 'families' | 'plants' | 'companions';
export type CatalogueSelection = PlantFamily | PlantType | CompanionRule;
type CatalogueEntriesProps = { data: Catalogue; section: CatalogueSection; search: string;
  onRemove?: (entry: CatalogueSelection) => void;
  onOpen?: (entry: CatalogueSelection, siblings: CatalogueSelection[]) => void;
  onEdit: (entry: CatalogueSelection) => void; onGuidance?: (entry: PlantType) => void };

export function CatalogueEntries({ data, section, search, onEdit, onGuidance, onOpen, onRemove }: CatalogueEntriesProps) {
  const { t } = useI18n();
  const match = (text: string) => text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const familyMatches = data.families.filter((item) => match(`${item.name} ${item.notes}`));
  const cropMatches = data.plants.filter((item) => match(`${item.name} ${item.notes} ${item.scientificName ?? ''} ${data.families.find((family) => family.id === item.familyId)?.name ?? ''}`));
  const card = (entry: CatalogueSelection, title: string, open = () => onEdit(entry)) => <CatalogueEntryRow key={entry.id} title={title}
    actions={<><Button variant="secondary" data-detail-entry={entry.id} aria-label={`${data.isAdmin ? 'Edit' : 'View'} ${title}`} onClick={open}>{data.isAdmin ? 'Edit' : 'View'}</Button>
      {data.isAdmin && onRemove && <Button type="button" variant="danger" aria-label={t('catalogue.removeNamed', { name: title })} onClick={() => onRemove(entry)}>{t('catalogue.remove')}</Button>}
    </>} />;
  const targetName = (target: CompanionTarget) => target.kind === 'family'
    ? `${data.families.find((item) => item.id === target.id)?.name ?? 'Unknown family'} (family)`
    : target.kind === 'cultivar' ? `${data.cultivars?.find((item) => item.id === target.id)?.name ?? 'Unknown cultivar'} (cultivar)`
    : `${data.plants.find((item) => item.id === target.id)?.name ?? 'Unknown plant'} (plant type)`;
  let cards: ReactNode[];
  if (section === 'families') cards = familyMatches.map((item) => card(item, item.name, onOpen ? () => onOpen(item, familyMatches) : undefined));
  else if (section === 'plants') cards = cropMatches.map((item) => card(item, item.name, onOpen ? () => onOpen(item, cropMatches) : onGuidance ? () => onGuidance(item) : undefined));
  else cards = data.rules.filter((item) => match(`${targetName(item.first)} ${targetName(item.second)} ${item.relationship} ${item.notes}`)).map((item) => card(item, `${targetName(item.first)} + ${targetName(item.second)}`));
  return cards.length ? <ul className="space-y-3">{cards}</ul>
    : <p className="text-sm text-stone-600 dark:text-stone-400">{search ? 'No matching entries.' : 'No entries yet.'}</p>;
}
