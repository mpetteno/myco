import { useI18n } from '../../shared/i18n/I18nProvider';
import { DeleteHistoryPrompt } from './DeleteHistoryPrompt';
import { Button } from '../../shared/ui/Button';
import { HistoryCalendar } from './HistoryCalendar';
import { GardenEventForm } from './GardenEventForm';
import type { useGardenHistory } from './useGardenHistory';
import { ActivityForm } from '../activities/ActivityForm';
import { ActivityActions } from '../activities/ActivityActions';
import { HistoryEventList } from './HistoryEventList';

export function GardenHistoryInspector({ history, onReload }: { history: ReturnType<typeof useGardenHistory>; onReload: () => Promise<void> }) {
  const { t } = useI18n();
  if (!history.inspector) return null;
  return <aside aria-label="Garden layout history" className="flex max-h-[45%] min-h-0 shrink-0 flex-col border-t border-stone-200 bg-white lg:max-h-none lg:w-80 lg:border-t-0 lg:border-l xl:w-96 dark:border-stone-800 dark:bg-stone-900">
    <header className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-4 dark:border-stone-800">
      <h2 className="font-semibold">{history.bedId ? 'Bed history' : 'Garden history'}</h2>
      <button type="button" disabled={history.saving} onClick={() => history.setInspector(false)} className="min-h-11 cursor-pointer rounded-lg px-2 text-sm focus-visible:outline-2 focus-visible:outline-green-600">Hide history</button>
    </header>
    <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4">
      {history.activityForm ? <ActivityForm beds={history.getCurrent().beds} bedId={history.bedId}
        onSave={history.commitActivity} onReload={onReload} onCancel={() => history.setActivityForm(false)} /> : history.recording && history.current ? <GardenEventForm latestDate={history.events.at(-1)?.date} onSave={history.save} onReload={onReload} onCancel={() => history.setRecording(false)} /> : <>
        <Button variant="secondary" disabled={history.loading || history.saving} onClick={() => void history.startHistoryEdit()}>
          {history.bedId ? 'Add past bed edit' : 'Add past garden edit'}
        </Button>
        {history.selected && history.selected.status !== 'planned' && <Button variant="secondary" disabled={history.loading || history.saving} onClick={() => void history.startHistoryEdit(true)}>Edit history record</Button>}
        {history.selected && <Button variant="danger" disabled={history.loading || history.saving} onClick={() => history.setDeleting({ event: history.selected!, requestId: crypto.randomUUID() })}>Delete history entry</Button>}
        <ActivityActions history={history} />
        <HistoryCalendar date={history.date} events={history.events} disabled={history.loading || history.saving} onDate={(date) => void history.selectDate(date)} />
        {history.current && !history.bedId && <Button disabled={history.loading || history.saving} onClick={() => history.setRecording(true)}>{t('record.garden')}</Button>}
        <HistoryEventList events={history.events} history={history}/>
        {!history.loading && !history.events.length && <p className="text-sm">Your garden plan saves automatically. Record completed work after implementing it, or add a past edit.</p>}
        <Button variant="secondary" disabled={history.loading || history.saving} onClick={() => void history.refresh()}>Refresh history</Button>
      </>}
    </div>
    <DeleteHistoryPrompt history={history} />
  </aside>;
}
