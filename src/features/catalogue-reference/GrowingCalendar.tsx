import { useWorkspaceNavigation } from '../../shared/navigation/WorkspaceNavigation';
import { ReferenceCataloguePanel } from './ReferenceCataloguePanel';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { SelectField } from '../../shared/ui/SelectField';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { loadReferenceData } from './referenceRepository';
import { effectiveCalendar } from './referenceModel';
import type { ReferenceData, ReferenceRow } from './referenceModel';
import { calendarNote, formatWindows, monthInWindow, monthName } from './calendarMonths';
import { referenceText } from './referenceText';
import { MonthField } from './MonthField';
import { CropGuidancePanel } from '../catalogue/CropGuidancePanel';
import type { GardenLocation } from '../gardens/gardenLocation';
import type { GardenDocument } from '../gardens/gardenDocument';
import { areaPlanFromBed } from '../area-editor/areaPlan';

export function GrowingCalendar({ userId, location, garden }: { userId: string; location?: GardenLocation; garden?: GardenDocument }) {
  const { t, locale } = useI18n();
  const navigation = useWorkspaceNavigation();
  const [configuration, setConfiguration] = useState<'calendar_profiles' | 'calendar_coverage'>();
  const [data, setData] = useState<ReferenceData>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [annual, setAnnual] = useState(false);
  const [search, setSearch] = useState('');
  const [activity, setActivity] = useState('');
  const [gardenOnly, setGardenOnly] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [detail, setDetail] = useState<{ cropId: string; cultivarId?: string; name: string }>();
  const scroll = useRef(0);
  const list = useRef<HTMLDivElement>(null);
  const contextLocation = location ?? garden?.location;
  useEffect(() => { setProfileId(''); }, [contextLocation?.countryCode, contextLocation?.regionCode]);
  useEffect(() => {
    let alive = true; setError('');
    void loadReferenceData(userId).then((next) => { if (alive) setData(next); }).catch(() => { if (alive) setError(t('location.calendarFailed')); });
    return () => { alive = false; };
  }, [userId, attempt, t]);
  if (!data) return <div className="space-y-3"><p role={error ? 'alert' : 'status'}>{error || t('catalogue.loadingReference')}</p>{error && <Button onClick={() => setAttempt(attempt + 1)}>Try again</Button>}</div>;
  const coverage = data.calendar_coverage.find((row) => row.country_code === contextLocation?.countryCode && row.region_code === contextLocation?.regionCode);
  const profile = data.calendar_profiles.find((row) => row.id === (profileId || coverage?.calendar_profile_id)) ?? data.calendar_profiles[0];
  if (configuration) return <div className="space-y-4">
    <Button variant="secondary" onClick={() => { const back = () => setConfiguration(undefined); if (navigation) navigation.request(back); else back(); }}>Back to growing calendar</Button>
    <h2 className="text-lg font-semibold">{configuration === 'calendar_profiles' ? 'Calendar profiles' : 'Regional coverage'}</h2>
    <ReferenceCataloguePanel userId={userId} section={configuration} />
  </div>;
  if (detail) return <CropGuidancePanel {...detail} userId={userId} onBack={() => { setDetail(undefined); requestAnimationFrame(() => { list.current?.scrollIntoView({ block: 'start' }); const parent = list.current?.closest('[data-page-scroll]'); if (parent) parent.scrollTop = scroll.current; }); setAttempt(attempt + 1); }} />;
  const planted = new Set<string>();
  for (const bed of garden?.beds ?? []) for (const area of areaPlanFromBed(bed).areas) {
    if (area.kind === 'rows') planted.add(area.plant.id);
    if (area.kind === 'broadcast') {
      if (area.sowing.kind === 'crop') planted.add(area.sowing.plant.id);
      else for (const component of area.sowing.mixture.components) planted.add(component.plant.id);
    }
  }
  const windows = (entry: ReferenceRow) => data.calendar_windows.filter((window) => window.calendar_entry_id === entry.id);
  const active = (entry: ReferenceRow, selected: number) => windows(entry).some((window) => monthInWindow(selected, window.start_month, window.end_month));
  const owners = data.plant_types.flatMap((crop) => [
    { cropId: crop.id, cultivarId: undefined as string | undefined, name: String(crop.name) },
    ...data.plant_cultivars.filter((cultivar) => cultivar.plant_type_id === crop.id && data.plant_calendar_entries.some((entry) => entry.cultivar_id === cultivar.id)).map((cultivar) => ({ cropId: crop.id, cultivarId: cultivar.id as string | undefined, name: `${crop.name} · ${cultivar.name}` })),
  ]).filter((owner) => owner.name.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale)) && (!gardenOnly || planted.has(owner.cropId)))
    .map((owner) => ({ ...owner, entries: effectiveCalendar(data, owner.cropId, profile?.id ?? '', owner.cultivarId).filter((entry) => !activity || entry.activity === activity) }))
    .map((owner) => ({ ...owner, entries: owner.entries.filter((entry) => annual || active(entry, month)) }))
    .filter((owner) => owner.entries.length).sort((a,b) => a.name.localeCompare(b.name, locale));
  function open(owner: typeof owners[number]) {
    scroll.current = list.current?.closest('[data-page-scroll]')?.scrollTop ?? 0;
    setDetail(owner);
  }
  return <div ref={list} className="space-y-5">
    {error && <p role="alert">{error} Use Refresh calendar to try again.</p>}
    <div className="rounded-xl bg-green-50 p-4 text-sm text-green-950 dark:bg-green-950 dark:text-green-100">
      <p className="font-semibold">{profile ? String(profile.name) : 'No calendars available'}</p>
      <p>{coverage && !profileId ? contextLocation?.displayName : 'Reference calendar · not specific to your garden location.'}</p>
      {!coverage && contextLocation && <p>No calendar covers this garden’s region. Choose a reference calendar below.</p>}
      <details className="mt-2"><summary className="min-h-8 cursor-pointer underline underline-offset-4">About this calendar</summary><p>Seasonal guidance repeats each year. Local weather and crop maturity affect timing.</p></details>
    </div>
    {data.calendar_profiles.length > 0 && (!coverage || data.calendar_profiles.length > 1) && <SelectField id="growing-profile" label="Regional calendar" value={profile?.id ?? ''} onChange={(event) => setProfileId(event.target.value)}>
      {data.calendar_profiles.map((item) => <option key={item.id} value={item.id}>{String(item.name)}</option>)}
    </SelectField>}
    <div className="grid grid-cols-2 gap-2" aria-label="Calendar view">
      <Button variant={annual ? 'secondary' : 'primary'} aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly overview</Button>
      <Button variant={annual ? 'primary' : 'secondary'} aria-pressed={annual} onClick={() => setAnnual(true)}>Annual view</Button>
    </div>
    {!annual && <div className="space-y-3"><div className="grid grid-cols-[auto_1fr_auto_auto] items-end gap-2">
      <Button variant="secondary" aria-label="Previous month" onClick={() => setMonth(month === 1 ? 12 : month - 1)}>←</Button>
      <MonthField id="growing-month" label="Month" value={month} onChange={(event) => setMonth(Number(event.target.value))} />
      <Button variant="secondary" aria-label="Next month" onClick={() => setMonth(month % 12 + 1)}>→</Button>
      <Button variant="secondary" onClick={() => setMonth(new Date().getMonth() + 1)}>Today</Button>
    </div></div>}
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField id="growing-search" label="Search crops and varieties" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
      <SelectField id="growing-activity" label="Activity" value={activity} onChange={(event) => setActivity(event.target.value)}>
        <option value="">All activities</option>{['seedbed_sowing','direct_sowing','transplant','harvest'].map((value) => <option key={value} value={value}>{referenceText(t, value)}</option>)}
      </SelectField>
    </div>
    {garden && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={gardenOnly} onChange={(event) => setGardenOnly(event.target.checked)} />In this garden</label>}
    <p role="status" className="text-sm text-stone-600 dark:text-stone-400">{owners.length} crops and varieties{annual ? ' · Full year' : ` · ${monthName(month, locale, 'long')}`}</p>
    {!owners.length && <p>No matching activities. Try another month or clear the filters. Missing guidance does not mean a crop cannot be grown.</p>}
    <ul className="space-y-4">{owners.map((owner) => <li key={`${owner.cropId}:${owner.cultivarId ?? ''}`} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
      <h3 className="break-words text-lg font-semibold"><button type="button" className="min-h-11 cursor-pointer text-left text-green-800 underline underline-offset-4 dark:text-green-400" onClick={() => open(owner)}>{owner.name}</button></h3>
      <ul className="space-y-3">{owner.entries.map((entry) => <li key={entry.id} className="space-y-1 border-t border-stone-100 pt-3 dark:border-stone-800">
        <p className="text-sm font-medium">{referenceText(t, String(entry.activity))} · {referenceText(t, String(entry.planting_method))}{owner.cultivarId && <span className="ml-2 text-xs text-stone-500">{entry.cultivar_id ? 'Variety override' : 'Inherited from crop'}</span>}</p>
        <p className="text-sm">{formatWindows(windows(entry), locale) || t('catalogue.noWindows')}</p>
        {annual && <div role="img" aria-label={formatWindows(windows(entry), locale) || t('catalogue.noWindows')} className="grid grid-cols-12 gap-0.5">{Array.from({ length: 12 }, (_, i) => <span key={i} title={monthName(i + 1, locale, 'long')} className={`rounded py-2 text-center text-[10px] sm:text-xs ${active(entry, i + 1) ? 'bg-green-200 font-semibold text-green-950 dark:bg-green-800 dark:text-green-50' : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'}`}>{monthName(i + 1, locale).slice(0,1)}</span>)}</div>}
        {calendarNote(String(entry.notes ?? ''), windows(entry)) && <p className="whitespace-pre-wrap text-sm text-stone-600 dark:text-stone-400">{calendarNote(String(entry.notes ?? ''), windows(entry))}</p>}
      </li>)}</ul>
      <Button variant="secondary" onClick={() => open(owner)}>View details</Button>
    </li>)}</ul>
    <Button variant="secondary" onClick={() => setAttempt(attempt + 1)}>Refresh calendar</Button>
    {data.isAdmin && <details className="rounded-xl border border-stone-200 p-3 dark:border-stone-700"><summary className="min-h-11 cursor-pointer text-sm font-medium">Calendar settings</summary>
      <div className="space-y-2 pt-2"><Button variant="secondary" onClick={() => setConfiguration('calendar_profiles')}>Calendar profiles</Button>
        <Button variant="secondary" onClick={() => setConfiguration('calendar_coverage')}>Regional coverage</Button></div>
    </details>}
  </div>;
}
