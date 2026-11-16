import type { Ref } from 'react';
import type { GardenDocument, SavedGarden } from '../gardens/gardenDocument';
import type { GardenEventDetails, GardenEventSnapshot } from './gardenHistory';

export type HistoryDraft = { event?: GardenEventSnapshot; document: GardenDocument; details: GardenEventDetails;
  basis?: string; kind: 'layout' | 'bed' | 'planting' | 'mulch'; bedId?: string };
export type HistoryDraftBridge = { beforeLeaving: () => Promise<string | null>; getCurrent: () => SavedGarden };
export type HistoryEditorOptions = { bedId?: string; bridge: Ref<HistoryDraftBridge>;
  onValidityChange: (valid: boolean) => void };
export const historyDocument = ({ name, dimensions, beds }: GardenDocument): GardenDocument => ({ name, dimensions, beds });
