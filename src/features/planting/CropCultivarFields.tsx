import { useState } from 'react';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { SelectField } from '../../shared/ui/SelectField';
import type { Catalogue } from '../catalogue/catalogue';
import type { PlantSnapshot } from './plantingPlan';

export function CropCultivarFields({ catalogue, plant, onPlant, idPrefix = 'planting' }: {
  catalogue: Catalogue; plant?: PlantSnapshot; onPlant: (key: string) => void; idPrefix?: string;
}) {
  const { t } = useI18n();
  // A browsing filter never changes the planting until an actual crop is chosen.
  const [familyId, setFamilyId] = useState('');
  const activeFamily = catalogue.families.some((family) => family.id === familyId) ? familyId : '';
  const cropId = plant?.id ?? '';
  const crops = catalogue.plants.filter((crop) => !activeFamily || crop.familyId === activeFamily);
  const outsideFilter = !!plant && !crops.some((crop) => crop.id === plant.id) && !!activeFamily;
  const cultivars = (catalogue.cultivars ?? []).filter((cultivar) => cultivar.plantTypeId === cropId);
  const savedCrop = !!plant && !catalogue.plants.some((crop) => crop.id === plant.id);
  return <div className="space-y-3">
    <SelectField id={`${idPrefix}-family`} label={t('planting.filterFamily')} value={activeFamily} onChange={(event) => setFamilyId(event.target.value)}>
      <option value="">{t('planting.allFamilies')}</option>
      {catalogue.families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
    </SelectField>
    <SelectField id={`${idPrefix}-crop`} label={t('catalogue.label.crop')} value={outsideFilter ? '' : cropId} onChange={(event) => onPlant(event.target.value)}>
      {(!plant || outsideFilter) && <option value="" disabled>{activeFamily ? t('planting.chooseFilteredCrop') : t('catalogue.choosePlant')}</option>}
      {savedCrop && !outsideFilter && <option value={cropId}>{t('planting.savedReference', { name: plant.name })}</option>}
      {crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}
    </SelectField>
    {!crops.length && <p className="text-sm text-stone-600 dark:text-stone-400">{t(activeFamily ? 'planting.noFamilyCrops' : 'planting.noCrops')}</p>}
    {outsideFilter && <p role="status" className="text-sm text-stone-600 dark:text-stone-400">{t('planting.currentOutsideFilter', { name: plant.name })}</p>}
    {!outsideFilter && (cultivars.length > 0 || plant?.cultivarId) && <SelectField id={`${idPrefix}-cultivar`} label={t('catalogue.cultivarOptional')} value={plant?.cultivarId ?? ''}
      onChange={(event) => onPlant(event.target.value ? `cultivar:${event.target.value}` : cropId)}>
      <option value="">{t('catalogue.unspecifiedCultivar')}</option>
      {plant?.cultivarId && !cultivars.some((cultivar) => cultivar.id === plant.cultivarId) && <option value={plant.cultivarId}>{t('planting.savedReference', { name: plant.cultivarName ?? '' })}</option>}
      {cultivars.map((cultivar) => <option key={cultivar.id} value={cultivar.id}>{cultivar.name}</option>)}
    </SelectField>}
  </div>;
}
