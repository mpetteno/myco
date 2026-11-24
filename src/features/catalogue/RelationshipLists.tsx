import { useI18n } from '../../shared/i18n/I18nProvider';
import { SelectField } from '../../shared/ui/SelectField';
import { linkCropRelationship, removeCropRelationship } from './cropEditor';
import type { CropDraft, EditorTable } from './cropEditor';
import { automaticFamilyPredecessor } from './rotationRules';

type Props = { table: Extract<EditorTable, 'companion_rules' | 'rotation_rules'>; draft: CropDraft; initial: CropDraft;
  targets: { value: string; label: string; familyId?: string }[]; rotationFamilyId?: string;
  editable: boolean; pending: boolean; onChange: (draft: CropDraft) => void };

export function RelationshipLists({ table, draft, initial, targets, rotationFamilyId, editable, pending, onChange }: Props) {
  const { t } = useI18n();
  const groups = table === 'companion_rules'
    ? [{ value: 'companion', label: t('catalogue.suggestedCompanions') }, { value: 'caution', label: t('catalogue.caution') }]
    : [{ value: 'favourable_after', label: t('catalogue.favourablePredecessors') }, { value: 'avoid_after', label: t('catalogue.avoidPredecessors') }];
  const rows = draft.rows.filter((row) => row.table === table);
  const automaticTarget = table === 'rotation_rules' ? automaticFamilyPredecessor(rotationFamilyId) : undefined;
  const showAutomatic = !!automaticTarget && !rows.some((row) => !row.removed && row.values.target === automaticTarget);
  const name = (target: string) => targets.find((item) => item.value === target)?.label ?? t('catalogue.unknownPlant');
  const link = (target: string, relationship: string) => onChange(linkCropRelationship(draft, initial, table, target, relationship));
  return <div className="space-y-3">
    <div className="grid gap-4 sm:grid-cols-2">{groups.map((group) => {
      const other = groups.find((item) => item.value !== group.value)!;
      const selected = rows.filter((row) => !row.removed && row.values.relationship === group.value).sort((a, b) => name(a.values.target).localeCompare(name(b.values.target)));
      const removed = rows.filter((row) => row.removed && row.values.relationship === group.value);
      const automaticInGroup = showAutomatic && group.value === 'avoid_after';
      const choices = targets.filter((target) => !selected.some((row) => row.values.target === target.value) && !(automaticInGroup && target.value === automaticTarget));
      const groupId = `${table}-${group.value}`;
      return <div key={group.value} role="group" aria-labelledby={`${groupId}-heading`} className="min-w-0 space-y-3 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
        <h5 id={`${groupId}-heading`} className="flex items-center justify-between gap-2 text-sm font-semibold"><span>{group.label}</span><span className="text-xs font-normal text-stone-500">{selected.length + Number(automaticInGroup)}</span></h5>
        {selected.length || automaticInGroup ? <ul className="space-y-2">
          {automaticInGroup && <li className="min-w-0 space-y-1 rounded-lg bg-stone-50 px-3 py-2 text-sm dark:bg-stone-950">
            <span className="block break-words">{name(automaticTarget!)}</span>
            <span className="block text-xs text-stone-500 dark:text-stone-400">{t('catalogue.automatic')}</span>
          </li>}
          {selected.map((row) => {
          const before = initial.rows.find((item) => item.key === row.key);
          const overridden = row.inherited && row.values.relationship !== before?.values.relationship;
          const exception = table === 'rotation_rules' && row.values.relationship === 'favourable_after' && !!rotationFamilyId && targets.find((target) => target.value === row.values.target)?.familyId === rotationFamilyId;
          return <li key={row.key} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm dark:bg-stone-950">
            <span className="min-w-0 flex-1 break-words">{name(row.values.target)}{exception && <span className="mt-1 block text-xs text-stone-500 dark:text-stone-400">{t('catalogue.rotationException')}</span>}{row.inherited && <span className="mt-1 block text-xs text-stone-500 dark:text-stone-400">{t(overridden ? 'catalogue.unsavedOverride' : 'catalogue.inherited')}</span>}</span>
            {editable && <div className="flex shrink-0 items-center gap-1">
              <button type="button" disabled={pending} aria-label={t('catalogue.moveRelationship', { name: name(row.values.target), list: other.label })} title={t('catalogue.moveRelationship', { name: name(row.values.target), list: other.label })}
                className="min-h-10 min-w-10 cursor-pointer rounded-md text-stone-600 hover:bg-stone-100 disabled:opacity-50 dark:text-stone-300 dark:hover:bg-stone-800" onClick={() => link(row.values.target, other.value)}>⇄</button>
              {(!row.inherited || overridden) && <button type="button" disabled={pending} aria-label={t('catalogue.removeNamed', { name: name(row.values.target) })}
                className="min-h-10 min-w-10 cursor-pointer rounded-md text-red-700 hover:bg-stone-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-stone-800" onClick={() => onChange(removeCropRelationship(draft, initial, row.key))}>×</button>}
            </div>}
          </li>;
        })}</ul> : <p className="text-sm text-stone-500 dark:text-stone-400">{t('catalogue.noLinkedPlants')}</p>}
        {removed.length > 0 && <ul className="space-y-1">{removed.map((row) => <li key={row.key} className="flex items-center justify-between gap-2 text-sm text-stone-500 dark:text-stone-400"><span className="break-words line-through">{name(row.values.target)}</span>
          <button type="button" disabled={pending} aria-label={t('catalogue.undoRelationship', { name: name(row.values.target) })} className="min-h-10 shrink-0 cursor-pointer underline" onClick={() => link(row.values.target, group.value)}>{t('catalogue.undo')}</button>
        </li>)}</ul>}
        {editable && <SelectField id={`${groupId}-add`} label={t('catalogue.addToRelationship', { list: group.label })} value="" disabled={pending || !choices.length} onChange={(event) => { if (event.target.value) link(event.target.value, group.value); }}>
          <option value="">{t('catalogue.chooseLinkedPlant')}</option>{choices.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
        </SelectField>}
      </div>;
    })}</div>
    {rows.some((row) => row.inherited) && <p className="text-xs text-stone-500 dark:text-stone-400">{t('catalogue.relationshipInheritance')}</p>}
    {automaticTarget && <p className="text-xs text-stone-500 dark:text-stone-400">{t('catalogue.automaticRotationHint')}</p>}
  </div>;
}
