import { monthInWindow } from '../catalogue-reference/calendarMonths';
export { monthInWindow } from '../catalogue-reference/calendarMonths';
import { companionAdvice } from '../catalogue/catalogue';
import type { Catalogue } from '../catalogue/catalogue';
import { effectiveCalendar, effectiveGuidance } from '../catalogue-reference/referenceModel';
import type { ReferenceData } from '../catalogue-reference/referenceModel';
import { rotationAdvice } from '../catalogue/rotationRules';
export { rotationAdvice } from '../catalogue/rotationRules';
import type { Bed, BedBounds } from '../beds/bed';
import type { BedAreaPlan } from '../area-editor/areaPlan';
import { defaultRowDirection, plantLabel, snapshotPlant } from '../planting/plantingPlan';
import type { PlantSnapshot } from '../planting/plantingPlan';
import { areaRowLayout } from '../planting/areaRowLayout';
import type { GardenLocation } from '../gardens/gardenLocation';
import type { SeedMixture } from '../seed-mixtures/seedMixture';
import { snapshotSeedMixture } from '../seed-mixtures/seedMixture';
import type { GroundObservation } from './groundHistory';
import { areaPlants, groundArea, intersection, precedingCrops } from './groundHistory';
import type { suggestionMessages } from './suggestionMessages';

export type SuggestionReason = { code: keyof typeof suggestionMessages; values?: Record<string, string | number>; sourceIds?: string[]; caution?: boolean };
export type PlantingSuggestion = { id: string; category: 'planting' | 'green_manure'; label: string; plants: PlantSnapshot[];
  areaId: string; reasons: SuggestionReason[]; season: 'now' | 'preparation' | 'unknown' | 'outside' | 'unavailable';
  action?: { selectionKey: string; purpose: 'crop' | 'green_manure' } };
export type CareReference = { plant: PlantSnapshot; guidance: Record<string, unknown>; reasons: SuggestionReason[] };
export type SuggestionInput = { bed: Bed; plan: BedAreaPlan; selectedId: string | null; date: string; location?: GardenLocation;
  catalogue: Catalogue; references: ReferenceData | null; mixtures: SeedMixture[]; history: GroundObservation[] | null };
export type SuggestionResult = { candidates: PlantingSuggestion[]; current: PlantingSuggestion | null;
  care: CareReference[]; notices: SuggestionReason[]; cover: boolean };



export function suggest(input: SuggestionInput): SuggestionResult {
  const { bed, plan, catalogue, references, location, date, history } = input;
  const selected = plan.areas.find((a) => a.id === input.selectedId);
  const month = Number(date.slice(5, 7));
  const coverage = references?.calendar_coverage.find((r) => r.country_code === location?.countryCode && r.region_code === location?.regionCode);
  const profile = references?.calendar_profiles.find((p) => p.id === coverage?.calendar_profile_id);
  const notices: SuggestionReason[] = [];
  if (!location) notices.push({ code: 'suggestions.regionMissing' });
  else if (references && !profile) notices.push({ code: 'suggestions.calendarMissing' });
  const target: BedBounds = selected ? { ...selected, xCm: bed.xCm + selected.xCm, yCm: bed.yCm + selected.yCm } : bed;
  const preceding = history ? precedingCrops(history, target) : null;
  if (preceding?.unknownArea) notices.push({ code: 'suggestions.partialHistory' });
  for (const { observation, overlap } of preceding?.crops ?? []) {
    notices.push({ code: 'suggestions.historyEvidence', values: { plant: plantLabel(observation.plant), date: observation.lastDate,
      percent: Math.round(overlap / groundArea(target) * 100) }, sourceIds: [observation.eventId] });
    if (!observation.endedAt) notices.push({ code: 'suggestions.ongoing', values: { plant: plantLabel(observation.plant) }, sourceIds: [observation.eventId] });
  }
  function evaluate(plants: PlantSnapshot[], mixture = false) {
    const reasons: SuggestionReason[] = [];
    const seasons: PlantingSuggestion['season'][] = [];
    for (const plant of plants) {
      const entries = profile && references ? effectiveCalendar(references, plant.id, profile.id, plant.cultivarId) : [];
      const planting = entries.filter((e) => ['direct_sowing', ...(!mixture ? ['seedbed_sowing', ...(selected?.kind !== 'broadcast' ? ['transplant'] : [])] : [])].includes(String(e.activity)));
      const active = planting.filter((e) => references!.calendar_windows.some((w) => w.calendar_entry_id === e.id && monthInWindow(month, w.start_month, w.end_month)));
      const direct = active.filter((e) => e.activity !== 'seedbed_sowing');
      const windows = planting.some((e) => references!.calendar_windows.some((w) => w.calendar_entry_id === e.id));
      const season = direct.length ? 'now' : active.length ? 'preparation' : !planting.length ? 'unknown' : windows ? 'outside' : 'unavailable';
      seasons.push(season);
      for (const e of active) reasons.push({ code: e.activity === 'seedbed_sowing' ? 'suggestions.preparation' : 'suggestions.inSeason',
        values: { plant: plantLabel(plant), activity: String(e.activity), method: String(e.planting_method), notes: String(e.notes ?? '') }, sourceIds: [e.id] });
      if (!active.length) reasons.push({ code: season === 'outside' ? 'suggestions.outSeason' : season === 'unavailable' ? 'suggestions.unavailable' : 'suggestions.seasonUnknown',
        values: { plant: plantLabel(plant) }, sourceIds: planting.map((e) => e.id), caution: season === 'outside' || season === 'unavailable' });
      if (history) {
        const intervalObservations = new Set<GroundObservation>();
        const years = references ? Number(effectiveGuidance(references, plant.id, plant.cultivarId).rotation_years) : 0;
        if (years > 0) for (const observation of history) {
          if (observation.plant.familyId !== plant.familyId || !intersection(observation, target)) continue;
          // A still-recorded crop has no known removal date. For a closed
          // observation use the next checkpoint as a conservative upper bound.
          const bound = observation.endedAt ?? date;
          const anniversary = `${String(Number(bound.slice(0, 4)) + years).padStart(4, '0')}${bound.slice(4)}`;
          if (anniversary > date) {
            intervalObservations.add(observation);
            reasons.push({ code: 'suggestions.rotationInterval', values: { years, plant: plantLabel(observation.plant), date: observation.endedAt ?? observation.lastDate }, caution: true, sourceIds: [observation.eventId] });
          }
        }
        for (const { observation } of preceding?.crops ?? []) {
          const result = rotationAdvice(plant, observation.plant, references?.rotation_rules ?? []);
          if (result.automatic) {
            if (!intervalObservations.has(observation)) reasons.push({ code: 'suggestions.rotationFamily',
              values: { plant: plantLabel(observation.plant), family: plant.familyName || observation.plant.familyName }, caution: true, sourceIds: [observation.eventId] });
          } else if (result.relationship !== 'unknown') reasons.push({ code: result.relationship === 'avoid_after' ? 'suggestions.rotationAvoid' : 'suggestions.rotationGood',
            values: { plant: plantLabel(observation.plant), notes: result.rules.map((rule) => rule.notes).filter(Boolean).join(' ') },
            caution: result.relationship === 'avoid_after', sourceIds: [...result.rules.map((rule) => rule.id), observation.eventId] });
        }
      }
      for (const area of plan.areas) {
        const neighbors = area.id === selected?.id ? [] : [...areaPlants(area)];
        for (const layer of area.mulch) {
          const crop = catalogue.plants.find((p) => p.id === layer.material.plantTypeId);
          const cultivar = catalogue.cultivars?.find((c) => c.id === layer.material.cultivarId);
          if (crop) neighbors.push(snapshotPlant(crop, catalogue, cultivar));
        }
        for (const other of neighbors) {
          const result = companionAdvice(plant, other, catalogue.rules);
          if (result.relationship !== 'unknown') reasons.push({ code: result.relationship === 'caution' ? 'suggestions.companionCaution' : 'suggestions.companionGood',
            values: { plant: plantLabel(other), notes: result.rules.map((r) => r.notes).filter(Boolean).join(' ') },
            caution: result.relationship === 'caution', sourceIds: result.rules.map((r) => r.id) });
        }
      }
      for (const other of plants.filter((p) => p !== plant)) {
        const result = companionAdvice(plant, other, catalogue.rules);
        if (result.relationship !== 'unknown') reasons.push({ code: result.relationship === 'caution' ? 'suggestions.companionCaution' : 'suggestions.companionGood',
          values: { plant: plantLabel(other), notes: result.rules.map((r) => r.notes).filter(Boolean).join(' ') },
          caution: result.relationship === 'caution', sourceIds: result.rules.map((r) => r.id) });
      }
      if (selected && !mixture && selected.kind !== 'broadcast') {
        if (!plant.plantSpacingCm || !plant.rowSpacingCm) reasons.push({ code: 'suggestions.spacingUnknown' });
        else {
          const layout = areaRowLayout({ version: 5, respectAreaSpacing: false, areas: [], advice: [] }, {
            ...selected, plant, plantSpacingCm: plant.plantSpacingCm, rowSpacingCm: plant.rowSpacingCm,
            rowDirection: selected.kind === 'rows' ? selected.rowDirection : defaultRowDirection(bed),
            rowCount: selected.kind === 'rows' ? selected.rowCount : 2,
          }, bed);
          if (layout.error || !layout.columns || !layout.rows) reasons.push({ code: 'suggestions.noFit', caution: true });
        }
      }
    }
    const weight = { now: 0, unknown: 1, preparation: 2, outside: 3, unavailable: 4 };
    const season = [...seasons].sort((a, b) => weight[b] - weight[a])[0] ?? 'unknown';
    // Collapse repeated reasons while retaining their evidence.
    return { season, reasons: [...new Map(reasons.map((r) => [JSON.stringify(r), r])).values()] };
  }
  const candidates: PlantingSuggestion[] = [];
  if (selected) {
    for (const crop of catalogue.plants) for (const cultivar of [undefined, ...(catalogue.cultivars ?? []).filter((c) => c.plantTypeId === crop.id)]) {
      const plant = snapshotPlant(crop, catalogue, cultivar), id = cultivar ? `cultivar:${cultivar.id}` : crop.id;
      const evaluated = evaluate([plant]);
      candidates.push({ id, category: 'planting', areaId: selected.id, label: plantLabel(plant), plants: [plant], ...evaluated,
        ...(!['preparation', 'unavailable'].includes(evaluated.season) ? { action: { selectionKey: id, purpose: 'crop' as const } } : {}) });
    }
    for (const mixture of input.mixtures) {
      let plants: PlantSnapshot[];
      try { plants = snapshotSeedMixture(mixture, catalogue).components.map((c) => c.plant); } catch { continue; }
      const evaluated = evaluate(plants, true), id = `mixture:${mixture.id}`;
      candidates.push({ id, category: 'green_manure', areaId: selected.id, label: mixture.name, plants, ...evaluated,
        reasons: [...evaluated.reasons, { code: 'suggestions.density' }],
        ...(evaluated.season !== 'unavailable' ? { action: { selectionKey: id, purpose: 'green_manure' as const } } : {}) });
    }
  }
  const rank = (s: PlantingSuggestion) => {
    const caution = s.reasons.some((r) => r.caution);
    const uncertain = s.reasons.some((r) => ['suggestions.spacingUnknown', 'suggestions.seasonUnknown'].includes(r.code)) || !history || !!preceding?.unknownArea;
    const goodRotation = s.reasons.some((r) => r.code === 'suggestions.rotationGood');
    const goodCompanion = s.reasons.some((r) => r.code === 'suggestions.companionGood');
    return [s.season === 'now' ? 0 : 1, caution ? 1 : 0, uncertain ? 1 : 0,
      { now: 0, unknown: 1, preparation: 2, outside: 3, unavailable: 4 }[s.season], goodRotation ? 0 : 1, goodCompanion ? 0 : 1];
  };
  candidates.sort((a, b) => { const first = rank(a), second = rank(b); return first.map((n, i) => n - second[i]).find((n) => n !== 0) || a.label.localeCompare(b.label, 'en') || a.id.localeCompare(b.id); });
  const selectedPlants = selected ? areaPlants(selected) : plan.areas.flatMap(areaPlants);
  const care = references ? [...new Map(selectedPlants.map((p) => [`${p.id}:${p.cultivarId ?? ''}`, p])).values()].map((plant) => {
    const entries = profile ? effectiveCalendar(references, plant.id, profile.id, plant.cultivarId) : [];
    const reasons: SuggestionReason[] = [];
    if (entries.some((e) => e.activity === 'harvest' && references.calendar_windows.some((w) => w.calendar_entry_id === e.id && monthInWindow(month, w.start_month, w.end_month)))) reasons.push({ code: 'suggestions.harvest' });
    const depths = references.plant_depths.filter((d) => d.plant_type_id === plant.id && (!d.cultivar_id || d.cultivar_id === plant.cultivarId));
    for (const d of depths.filter((d) => d.cultivar_id || !depths.some((o) => o.cultivar_id && o.planting_method === d.planting_method))) reasons.push({ code: 'suggestions.depth', values: { method: d.planting_method, depth: d.depth_cm, notes: d.notes }, sourceIds: [d.id] });
    return { plant, guidance: effectiveGuidance(references, plant.id, plant.cultivarId), reasons };
  }) : [];
  const current = selected && selectedPlants.length ? { id: 'current', category: selected.purpose === 'green_manure' ? 'green_manure' as const : 'planting' as const,
    label: selectedPlants.map(plantLabel).join(', '), plants: selectedPlants, areaId: selected.id, ...evaluate(selectedPlants, selected.purpose === 'green_manure') } : null;
  const assigned = plan.areas.reduce((sum, a) => sum + groundArea(a), 0);
  return { candidates, current, care, notices, cover: selected ? selected.mulch.length === 0 && selected.purpose !== 'green_manure'
    : assigned < groundArea(bed) || plan.areas.some((a) => !a.mulch.length && a.purpose !== 'green_manure') };
}
