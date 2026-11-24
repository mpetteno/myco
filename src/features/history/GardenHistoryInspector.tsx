import { useI18n } from '../../shared/i18n/I18nProvider';
import { DeleteHistoryPrompt } from './DeleteHistoryPrompt';
import { Button } from '../../shared/ui/Button';
import { GardenEventForm } from './GardenEventForm';
import type { useGardenHistory } from './useGardenHistory';
import { ActivityForm } from '../activities/ActivityForm';
import { ActivityActions } from '../activities/ActivityActions';
import { WorkCalendar } from '../work-calendar/WorkCalendar';

export function GardenHistoryInspector({ history, onReload, inspectionOnly = false, onFullCalendar, visible = true, onClose, showClose = true }: {
  history: ReturnType<typeof useGardenHistory>; onReload: () => Promise<void>; inspectionOnly?: boolean; onFullCalendar?: () => void; visible?: boolean; onClose?: () => void; showClose?: boolean;
}) {
  const { t } = useI18n();
  if (!history.open) return null;
  const garden = history.getCurrent();
  return <aside aria-label="Editor calendar" className="flex max-h-[55%] min-h-0 shrink-0 flex-col border-t border-stone-200 bg-white lg:max-h-none lg:w-80 lg:border-t-0 lg:border-l xl:w-96 dark:border-stone-800 dark:bg-stone-900">
    <header className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-4 dark:border-stone-800">
      <h2 className="mr-auto font-semibold">Calendar</h2>
      {showClose && <button type="button" disabled={history.saving} onClick={onClose ?? history.close} className="min-h-11 cursor-pointer rounded-lg px-2 text-sm focus-visible:outline-2 focus-visible:outline-green-600">Close calendar</button>}
    </header>
    <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4">
      <p className="break-words text-xs font-medium">{garden.name} · {history.bedId ? garden.beds.find(bed => bed.id === history.bedId)?.name ?? 'Recorded bed' : 'All beds'}{history.current && ' · Current plan'}</p>
      {!history.current ? <section aria-label="Recorded state" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
        <p className="break-words">{history.selected ? `Read-only · ${history.selected.date} · ${history.selected.title}` : `No recorded state on or before ${history.date}.`}</p>
        <Button variant="secondary" disabled={history.saving} onClick={history.returnToPlan}>Return to current plan</Button>
      </section> : null}
      {history.loading && <p role="status" className="text-sm">Loading history…</p>}
      {history.error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{history.error}</p>}
      {history.message && <p role="status" className="text-sm text-green-800 dark:text-green-400">{history.message}</p>}
      {history.activityForm ? <ActivityForm beds={garden.beds} bedId={history.bedId}
        onSave={history.commitActivity} onReload={onReload} onCancel={() => history.setActivityForm(false)} /> : history.recording && history.current ? <GardenEventForm latestDate={history.events.at(-1)?.date} onSave={history.save} onReload={onReload} onCancel={() => history.setRecording(false)} /> : <>
        <WorkCalendar garden={garden} visible={visible} editor={history} onFullCalendar={onFullCalendar} onOpenHistory={async entry => { if (entry.event) await history.select(entry.event); }} />
          {history.selected && <section aria-label="Selected record actions" className="space-y-2 border-t border-stone-200 pt-3 dark:border-stone-700"><h3 className="text-xs font-semibold">Selected record</h3>
            <Button variant="secondary" disabled={history.loading || history.saving} onClick={() => void history.startHistoryEdit(true)}>Edit history record</Button>
            <Button variant="danger" disabled={history.loading || history.saving} onClick={() => history.setDeleting({ event: history.selected!, requestId: crypto.randomUUID() })}>Delete history entry</Button>
          </section>}
        <details className="border-t border-stone-200 pt-3 dark:border-stone-700"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Record completed work</summary>
        <div className="space-y-2 pt-2">
          <p className="text-xs text-stone-500">Record work done from the saved plan, or add a past record.</p>
          <Button variant="secondary" disabled={history.loading || history.saving} onClick={() => void history.startHistoryEdit()}>
            {history.bedId ? 'Add past bed edit' : 'Add past garden edit'}
          </Button>
          {!inspectionOnly && <ActivityActions history={history} />}
          {!inspectionOnly && history.current && !history.bedId && <Button disabled={history.loading || history.saving} onClick={() => history.setRecording(true)}>{t('record.garden')}</Button>}
        </div></details>
      </>}
    </div>
    <DeleteHistoryPrompt history={history} />
  </aside>;
}
