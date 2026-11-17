import { useState } from 'react';
import { TextField } from '../../shared/ui/TextField';
import { SelectField } from '../../shared/ui/SelectField';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { createRegionLocation, supportedRegions } from './gardenLocation';
import type { GardenLocation } from './gardenLocation';

export function GardenLocationFields({ value, onChange, disabled }: { value?: GardenLocation; onChange: (location: GardenLocation | undefined) => void; disabled?: boolean }) {
  const { t } = useI18n();
  const [region, setRegion] = useState(value?.regionCode ?? '');
  const [city, setCity] = useState(value?.city ?? '');
  return <fieldset className="space-y-3" disabled={disabled}>
    <legend className="font-medium">{t('location.title')}</legend>
    <SelectField id="garden-location-region" label={t('location.region')} required value={region}
      onChange={(event) => { setRegion(event.target.value); onChange(createRegionLocation(event.target.value, city)); }}>
      <option value="">{t('location.chooseRegion')}</option>
      {supportedRegions.map((code) => <option key={code} value={code}>{t(`catalogue.option.${code}`)}</option>)}
    </SelectField>
    <TextField id="garden-location-city" label={t('location.city')} maxLength={100} value={city}
      onChange={(event) => { setCity(event.target.value); onChange(createRegionLocation(region, event.target.value)); }} />
  </fieldset>;
}
