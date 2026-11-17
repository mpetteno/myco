import { useI18n } from '../../shared/i18n/I18nProvider';
import { SelectField } from '../../shared/ui/SelectField';
import type { Catalogue } from '../catalogue/catalogue';
import type { PlantSnapshot } from './plantingPlan';

export function CropCultivarFields({ catalogue, plant, onPlant, idPrefix = 'planting' }: {
  catalogue: Catalogue; plant?: PlantSnapshot; onPlant: (key: string) => void; idPrefix?: string;
}) {
  const { t } = useI18n();
  const cropId = plant?.id ?? '';
  const cultivars = (catalogue.cultivars ?? []).filter((cultivar) => cultivar.plantTypeId === cropId);
  return <div className="space-y-3">
    <SelectField id={`${idPrefix}-crop`} label={t('catalogue.label.crop')} value={cropId} onChange={(event) => onPlant(event.target.value)}>
      {!plant && <option value="" disabled>Choose a crop</option>}
      {plant && !catalogue.plants.some((crop) => crop.id === plant.id) && <option value={cropId}>{plant.name} (saved reference)</option>}
      {catalogue.plants.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}
    </SelectField>
    {(cultivars.length > 0 || plant?.cultivarId) && <SelectField id={`${idPrefix}-cultivar`} label={t('catalogue.cultivarOptional')} value={plant?.cultivarId ?? ''}
      onChange={(event) => onPlant(event.target.value ? `cultivar:${event.target.value}` : cropId)}>
      <option value="">{t('catalogue.unspecifiedCultivar')}</option>
      {plant?.cultivarId && !cultivars.some((cultivar) => cultivar.id === plant.cultivarId) && <option value={plant.cultivarId}>{plant.cultivarName} (saved reference)</option>}
      {cultivars.map((cultivar) => <option key={cultivar.id} value={cultivar.id}>{cultivar.name}</option>)}
    </SelectField>}
  </div>;
}
