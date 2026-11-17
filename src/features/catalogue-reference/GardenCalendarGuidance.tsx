import { useEffect, useState } from 'react';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { SelectField } from '../../shared/ui/SelectField';
import type { GardenLocation } from '../gardens/gardenLocation';
import { loadReferenceData } from './referenceRepository';
import { effectiveCalendar, effectiveGuidance, referenceSections } from './referenceModel';
import type { ReferenceData } from './referenceModel';
import { referenceText } from './referenceText';

export function GardenCalendarGuidance({ userId, location }: { userId: string; location?: GardenLocation }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<ReferenceData>();
  const [selection, setSelection] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    void loadReferenceData(userId).then((next) => { if (alive) { setData(next); setSelection(next.plant_types[0]?.id ?? ''); } }).catch(() => { if (alive) setError(t('location.calendarFailed')); });
    return () => { alive = false; };
  }, [userId, t]);
  if (!location) return <p>{t('location.missing')}</p>;
  if (error || !data) return <p role={error ? 'alert' : 'status'}>{error || t('catalogue.loadingReference')}</p>;
  const coverage = data.calendar_coverage.find((row) => row.country_code === location.countryCode && row.region_code === location.regionCode);
  const profile = data.calendar_profiles.find((row) => row.id === coverage?.calendar_profile_id);
  if (!profile) return <p>{t('location.noCalendar')}</p>;
  const cultivar = data.plant_cultivars.find((row) => `cultivar:${row.id}` === selection);
  const cropId = String(cultivar?.plant_type_id ?? selection);
  const entries = effectiveCalendar(data, cropId, profile.id, cultivar?.id);
  const care = effectiveGuidance(data, cropId, cultivar?.id);
  const depths = data.plant_depths.filter((row) => row.plant_type_id === cropId && (!row.cultivar_id || row.cultivar_id === cultivar?.id));
  const effectiveDepths = depths.filter((row) => row.cultivar_id || !depths.some((other) => other.cultivar_id && other.planting_method === row.planting_method));
  const text = (value: unknown) => referenceText(t, String(value));
  const month = (value: unknown) => new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, Number(value) - 1, 1)));
  return <div className="space-y-4">
    <p>{location.displayName}</p><p className="font-medium">{String(profile.name)}</p>
    <SelectField id="guidance-plant" label={text('Crop')} value={selection} onChange={(e) => setSelection(e.target.value)}>
      {data.plant_types.map((crop) => <option key={crop.id} value={crop.id}>{String(crop.name)}</option>)}
      {data.plant_cultivars.map((item) => <option key={item.id} value={`cultivar:${item.id}`}>{String(data.plant_types.find((crop) => crop.id === item.plant_type_id)?.name)} · {String(item.name)}</option>)}
    </SelectField>
    {!entries.length && !Object.keys(care).length && !depths.length && <p>{t('location.noGuidance')}</p>}
    <ul className="space-y-3">{entries.map((entry) => <li key={entry.id} className="rounded-lg border border-stone-200 p-3 dark:border-stone-700">
      <p className="font-medium">{text(entry.activity)} · {text(entry.planting_method)}</p>
      <p>{data.calendar_windows.filter((window) => window.calendar_entry_id === entry.id).map((window) => `${month(window.start_month)}–${month(window.end_month)}`).join('; ') || t('catalogue.noWindows')}</p>
      {entry.notes ? <p>{String(entry.notes)}</p> : null}
    </li>)}</ul>
    <dl className="space-y-2 text-sm">{referenceSections.plant_guidance.fields.filter((field) => !field.reference && care[field.key] != null).map((field) => <div key={field.key}><dt className="font-medium">{text(field.label)}</dt><dd>{typeof care[field.key] === 'boolean' ? text(care[field.key] ? 'Yes' : 'No') : text(care[field.key])}</dd></div>)}</dl>
    {effectiveDepths.map((depth) => <p key={depth.id}>{text('Depth (cm)')} · {text(depth.planting_method)}: {String(depth.depth_cm)} cm {String(depth.notes ?? '')}</p>)}
  </div>;
}
