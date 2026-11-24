import type { SavedGarden } from '../gardens/gardenDocument';
import { savedRowPlan, savedMulchPlan, seedLabel, sowingQuantity } from '../area-editor/areaPlan';
import { plantLabel } from '../planting/plantingPlan';
import { previewPlanting } from '../planting/plantingGeometry';
import { formatArea } from '../../shared/units/area';
import type { ActivityType } from './workModel';

export type WorkItem = { id: string; text: string; done: boolean };
export type TaskWork = { workRecap: string; workItems: WorkItem[] };
export const MAX_WORK_ITEMS = 100;
export function validateWork(recap: unknown, items: unknown): string | null {
  if (typeof recap !== 'string' || recap.length > 4000) return 'Use at most 4,000 characters for the recap.';
  if (!Array.isArray(items) || items.length > MAX_WORK_ITEMS) return 'Use up to 100 checklist items.';
  const ids = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== 'object' || Object.keys(item).some(key => !['id','text','done'].includes(key))
      || typeof item.id !== 'string' || !item.id.trim() || item.id.length > 128 || ids.has(item.id)
      || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 500 || typeof item.done !== 'boolean') return 'Each checklist item needs a unique ID and an instruction of 1 to 500 characters.';
    ids.add(item.id);
  }
  return null;
}
const bounded = (value: string, length: number) => value.length > length ? value.slice(0, length - 1) + '…' : value;

// Describe saved quantities; this is a reviewable work list, never another layout.
export function generateTaskWork(garden: SavedGarden, bedId: string, activity: ActivityType): TaskWork {
  const beds = bedId ? garden.beds.filter(bed => bed.id === bedId) : garden.beds;
  if (bedId && !beds.length) return { workRecap: 'The selected bed is no longer in this garden. Choose a scope and generate a new recap.', workItems: [] };
  const lines: string[] = [], instructions: string[] = [];
  const add = (text: string) => { if (instructions.length <= MAX_WORK_ITEMS) instructions.push(bounded(text,500)); };
  for (const bed of beds) {
    if (instructions.length > MAX_WORK_ITEMS) break;
    const rowPlan = savedRowPlan(bed), preview = rowPlan?.areas.length ? previewPlanting(rowPlan,bed) : null;
    lines.push(`${bed.name} · ${bed.widthCm} × ${bed.lengthCm} cm${preview && !preview.error ? ` · ${preview.points.length} row plants` : ''}`);
    if (rowPlan?.areas.length) lines.push(rowPlan.areas.map((area,index)=>`${plantLabel(area.plant)}${preview&&!preview.error?` (${preview.counts[index]?.plants??0} plants)`:''}`).join(', '));
    for (const area of bed.areaPlan?.areas??[]) if (area.kind==='broadcast') lines.push(`${seedLabel(area.sowing)} · ${Number(sowingQuantity(area).total.toFixed(4))} ${area.densityUnit==='g_m2'?'g':'seeds'}`);
    const materials=[...new Set((savedMulchPlan(bed)?.areas??[]).flatMap(area=>area.layers.map(layer=>layer.material.name)))];
    if (materials.length) lines.push(`Mulch: ${materials.join(', ')}`);
    if (activity === 'planting' || activity === 'care' || activity === 'harvest') {
      for (const [index,area] of (rowPlan?.areas ?? []).entries()) {
        const areaIndex = bed.areaPlan ? bed.areaPlan.areas.findIndex(item=>item.id===area.id) : index;
        const location = `${bed.name} · Area ${areaIndex+1}`;
        const crop = plantLabel(area.plant), count = preview && !preview.error ? preview.counts[index]?.plants : undefined;
        const quantity = count === undefined ? crop : `${count} ${crop} plants`;
        if (activity === 'planting') add(`Plant ${quantity} in ${location}; follow the saved row layout.`);
        if (activity === 'care') add(`Check ${crop} in ${location} and carry out the care needed.`);
        if (activity === 'harvest') add(`Check ${crop} in ${location} for harvest readiness; harvest only what is ready.`);
      }
      for (const [index,area] of (bed.areaPlan?.areas ?? []).entries()) if (area.kind === 'broadcast') {
        const location = `${bed.name} · Area ${index+1}`, name = seedLabel(area.sowing), amount = sowingQuantity(area);
        if (activity === 'planting') add(`Sow ${Number(amount.total.toFixed(4))} ${area.densityUnit === 'g_m2' ? 'g' : 'seeds'} of ${name} in ${location} (${formatArea(area.widthCm*area.lengthCm)}).`);
        if (activity === 'care') add(`Check the ${name} sowing in ${location} and carry out the care needed.`);
        if (activity === 'harvest' && area.purpose !== 'green_manure') add(`Check ${name} in ${location} for harvest readiness.`);
      }
    }
    if (activity === 'mulch') for (const [index,area] of (savedMulchPlan(bed)?.areas ?? []).entries()) {
      add(`Apply mulch in ${bed.name} · ${bed.areaPlan ? 'Area' : 'Mulch area'} ${bed.areaPlan ? bed.areaPlan.areas.findIndex(item=>item.id===area.id)+1 : index+1}: ${area.layers.map(layer=>layer.material.name).join(' → ')} (bottom to top), covering ${formatArea(area.widthCm*area.lengthCm)}. Keep 5 cm clear around row plants.`);
    }
    if (activity === 'other') add(`Review and carry out the planned work in ${bed.name} (${bed.widthCm} × ${bed.lengthCm} cm).`);
  }
  if (instructions.length > MAX_WORK_ITEMS) {
    instructions.length = MAX_WORK_ITEMS-1;
    instructions.push('Review the remaining beds and areas in the saved plan and add any further work.');
  }
  if (!instructions.length) add(activity === 'mulch' ? 'Choose the mulch areas and materials to apply, then describe the work here.' : activity === 'harvest' ? 'Identify crops that are ready to harvest and describe the work here.' : activity === 'planting' ? 'Choose what to plant and where, then describe the work here.' : 'Describe the work to carry out in the selected scope.');
  const scope = bedId ? beds[0].name : `${garden.name} · ${garden.beds.length} ${garden.beds.length===1?'bed':'beds'}`;
  return { workRecap: bounded([scope,...lines].join('\n'),4000), workItems: instructions.map(text=>({ id:crypto.randomUUID(),text,done:false })) };
}
