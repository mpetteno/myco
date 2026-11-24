import { useId, useState } from 'react';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { Button } from '../../shared/ui/Button';
import { referenceText } from '../catalogue-reference/referenceText';
import { MAX_AREAS } from '../area-editor/areaPlan';
import { referenceSections } from '../catalogue-reference/referenceModel';
import { plantLabel } from '../planting/plantingPlan';
import type { useBedEditor } from '../bed-editor/useBedEditor';
import type { SuggestionReason } from './suggestionEngine';

export function BedSuggestions({ editor, summary = false, onEditMulch }: { editor: ReturnType<typeof useBedEditor>; summary?: boolean; onEditMulch?: () => void }) {
  const advice = editor.suggestions;
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  if (!advice.enabled) return null;
  const result = summary ? advice.summary : advice.result;
  const text = (value: unknown) => referenceText(t, String(value));
  function reason(r: SuggestionReason) {
    const values = { ...r.values };
    if (values.activity) values.activity = text(values.activity);
    if (values.method) values.method = text(values.method);
    return t(r.code, values);
  }
  const reasons = (items: SuggestionReason[]) => <ul className="list-disc space-y-1 pl-4 text-xs">{items.map((r, i) =>
    <li key={i} className={r.caution ? 'text-amber-800 dark:text-amber-300' : ''}>{reason(r)}</li>)}</ul>;
  return <section aria-label={t('suggestions.title')} className="space-y-3 border-t border-stone-200 pt-4 text-sm dark:border-stone-700">
    <h3 className="font-semibold">{t('suggestions.title')}</h3>
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1" htmlFor={id}>{t('suggestions.date')}
        <input id={id} type="date" value={advice.date} onChange={(e) => advice.setDate(e.target.value)}
          className="block min-h-11 w-full rounded-lg border border-stone-300 bg-transparent px-2 dark:border-stone-700" />
      </label>
      <Button variant="secondary" onClick={advice.today}>{t('suggestions.today')}</Button>
    </div>
    {editor.suggestionLocation && <div>{editor.suggestionLocation.displayName}</div>}
    {advice.loading && <div role="status">{t('suggestions.loading')}</div>}
    {advice.referenceError && <div role="status">{t('suggestions.referencesFailed')}</div>}
    {advice.historyError && <div role="status">{t('suggestions.historyFailed')}</div>}
    {(advice.referenceError || advice.historyError) && <Button variant="secondary" onClick={advice.retry}>{t('suggestions.retry')}</Button>}
    {result && <>
      {reasons(result.notices)}
      {result.cover && <div className="space-y-2">
        <div>{t('suggestions.cover')}</div>
        {!summary && editor.draft.selected && <Button variant="secondary" onClick={onEditMulch ?? (() => document.getElementById('area-mulch-controls')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))}>{t('suggestions.mulch')}</Button>}
      </div>}
      {!summary && result.current && <div className="space-y-1"><h4 className="font-medium">{t('suggestions.current')} · {result.current.label}</h4>{reasons(result.current.reasons)}</div>}
      {!summary && !editor.draft.selected && <div className="space-y-2"><div>{t('suggestions.chooseArea')}</div><Button variant="secondary" disabled={editor.leaving || editor.draft.loading || editor.draft.plan.areas.length >= MAX_AREAS} onClick={editor.draft.addArea}>{t('suggestions.add')}</Button></div>}
      {!summary && editor.draft.selected && <div className="space-y-2">
        <h4 className="font-medium">{t('suggestions.candidates')}</h4>
        {!result.candidates.length && <div>{t('suggestions.empty')}</div>}
        {(expanded ? result.candidates : result.candidates.slice(0, 5)).map((candidate) => <article key={candidate.id} className="space-y-2 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
          <h5 className="font-medium">{candidate.label}</h5>
          {candidate.category === 'green_manure' && <div className="text-xs">{t('suggestions.greenManure')}</div>}{reasons(candidate.reasons)}
          {candidate.action && <Button variant="secondary" disabled={editor.leaving || editor.draft.loading || advice.loading} onClick={() => editor.applySuggestion(candidate)}>{t('suggestions.use')}</Button>}
        </article>)}
        {!expanded && result.candidates.length > 5 && <Button variant="secondary" onClick={() => setExpanded(true)}>{t('suggestions.more')}</Button>}
      </div>}
      {result.care.map((care) => <div key={`${care.plant.id}:${care.plant.cultivarId ?? ''}`} className="space-y-2">
        <h4 className="font-medium">{t('suggestions.care', { plant: plantLabel(care.plant) })}</h4>
        <dl className="space-y-1 text-xs">{referenceSections.plant_guidance.fields.filter((f) => !f.reference && care.guidance[f.key] != null).map((field) =>
          <div key={field.key}><dt className="font-medium">{text(field.label)}</dt><dd>{typeof care.guidance[field.key] === 'boolean' ? text(care.guidance[field.key] ? 'Yes' : 'No') : text(care.guidance[field.key])}</dd></div>)}</dl>
        {reasons(care.reasons)}
      </div>)}
      <div className="text-xs text-stone-600 dark:text-stone-400">{t('suggestions.recordedOnly')}</div>
    </>}
  </section>;
}
