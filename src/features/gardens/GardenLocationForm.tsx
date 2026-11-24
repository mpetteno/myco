import { useState } from 'react';
import { validGardenLocation } from './gardenLocation';
import type { GardenLocation } from './gardenLocation';
import { GardenLocationFields } from './GardenLocationFields';
import { Button } from '../../shared/ui/Button';
import { useI18n } from '../../shared/i18n/I18nProvider';

export function GardenLocationForm({ initial, onSave }: { initial?: GardenLocation; onSave: (location: GardenLocation) => void }) {
  const { t } = useI18n();
  const [location, setLocation] = useState(initial);
  return <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (validGardenLocation(location)) onSave(location); }}>
    <GardenLocationFields value={location} onChange={setLocation} showTitle={false} />
    <Button type="submit" disabled={!validGardenLocation(location)}>{t('location.save')}</Button>
  </form>;
}
