import { TextAreaField } from '../../shared/ui/TextAreaField';
import type { TaskWork } from './taskWork';
import { MAX_WORK_ITEMS } from './taskWork';

export function TaskWorkFields({ work, pending, onChange, onGenerate }: { work: TaskWork; pending: boolean; onChange: (work: TaskWork) => void; onGenerate: () => void }) {
  return <fieldset aria-label="Work to do" className="space-y-3 rounded-xl border border-stone-200 p-3 dark:border-stone-700">
    <legend className="px-1 font-semibold">Work to do</legend>
    <p className="text-xs text-stone-600 dark:text-stone-400">Review and edit the saved-plan suggestion. Checking items records progress; confirm completion separately.</p>
    <TextAreaField id="task-work-recap" label="Recap" rows={3} maxLength={4000} value={work.workRecap} disabled={pending} onChange={e=>onChange({...work,workRecap:e.target.value})} />
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600 dark:text-stone-400"><span>{work.workItems.filter(item=>item.done).length}/{work.workItems.length} checked</span>
      <button type="button" disabled={pending} onClick={onGenerate} className="min-h-11 cursor-pointer px-2 font-medium underline disabled:opacity-40">Generate from saved plan</button>
    </div>
    <ol className="space-y-2">{work.workItems.map((item,index)=><li key={item.id} className="flex items-start gap-2 rounded-lg bg-stone-50 p-2 dark:bg-stone-950">
      <input type="checkbox" aria-label={`Mark work item ${index+1} done`} checked={item.done} disabled={pending} className="mt-3 h-5 w-5 shrink-0 accent-green-700" onChange={e=>onChange({...work,workItems:work.workItems.map(row=>row.id===item.id?{...row,done:e.target.checked}:row)})} />
      <textarea aria-label={`Work item ${index+1}`} value={item.text} rows={2} maxLength={500} required disabled={pending} className="min-h-12 min-w-0 flex-1 resize-y rounded-lg border border-stone-300 bg-white p-2 text-sm dark:border-stone-700 dark:bg-stone-900" onChange={e=>onChange({...work,workItems:work.workItems.map(row=>row.id===item.id?{...row,text:e.target.value}:row)})} />
      <button type="button" aria-label={`Remove work item ${index+1}`} title="Remove item" disabled={pending} className="min-h-11 min-w-11 cursor-pointer rounded-lg text-lg text-stone-600 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800" onClick={()=>onChange({...work,workItems:work.workItems.filter(row=>row.id!==item.id)})}>×</button>
    </li>)}</ol>
    {!work.workItems.length&&<p className="text-sm text-stone-500">No checklist items. Add an instruction or generate a recap.</p>}
    <button type="button" disabled={pending||work.workItems.length>=MAX_WORK_ITEMS} className="min-h-11 cursor-pointer rounded-lg px-2 text-sm font-medium underline disabled:opacity-40" onClick={()=>onChange({...work,workItems:[...work.workItems,{id:crypto.randomUUID(),text:'',done:false}]})}>Add work item</button>
  </fieldset>;
}

export function TaskWorkPreview({ work, open = false }: { work: Partial<TaskWork>; open?: boolean }) {
  const items = work.workItems ?? [];
  if (!work.workRecap && !items.length) return null;
  return <details open={open} className="rounded-lg border border-stone-200 p-3 dark:border-stone-700">
    <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">Work to do · {items.filter(item=>item.done).length}/{items.length} checked</summary>
    <div className="space-y-3 pt-2">
      {work.workRecap&&<p className="whitespace-pre-wrap break-words text-sm text-stone-600 dark:text-stone-400">{work.workRecap}</p>}
      <ul className="space-y-2 text-sm">{items.map(item=><li key={item.id} className="flex items-start gap-2"><span aria-label={item.done?'Checked':'Unchecked'} className="shrink-0">{item.done?'☑':'☐'}</span><span className={`min-w-0 break-words ${item.done?'text-stone-500 line-through':''}`}>{item.text}</span></li>)}</ul>
    </div>
  </details>;
}
