import type { Catalogue } from '../catalogue/catalogue';
import { effectiveCultivar } from '../catalogue/catalogue';
export type MulchType = { id: string; name: string; notes: string; version: number; categoryId?: string | null; categoryCode?: string; plantTypeId?: string | null; cultivarId?: string | null; available?: boolean };
export type MulchDetails = Pick<MulchType, 'name' | 'notes' | 'categoryId' | 'plantTypeId' | 'cultivarId'>;
export type MulchCatalogue = { types: MulchType[]; categories?: MulchCategory[]; plants?: Catalogue; isAdmin: boolean };

export function validateMulchDetails(details: MulchDetails): string | null {
  if (!details.name.trim() || details.name.trim().length > 100) return 'Enter a name of 1 to 100 characters.';
  if (details.notes.length > 2000) return 'Keep notes within 2000 characters.';
  return null;
}

export type MulchCategory = { id: string; code: 'organic' | 'synthetic' | 'living'; name: string; notes: string; version: number };
export function materialAvailable(material: MulchType, categories: MulchCategory[], plants: Catalogue): boolean {
  if (categories.find((category) => category.id === material.categoryId)?.code !== 'living') return true;
  const crop = plants.plants.find((item) => item.id === material.plantTypeId);
  const cultivar = material.cultivarId ? plants.cultivars?.find((item) => item.id === material.cultivarId && item.plantTypeId === crop?.id) : undefined;
  return !!crop && (!material.cultivarId || !!cultivar) && !!effectiveCultivar(crop, cultivar).livingMulchEnabled;
}

export function snapshotMulchMaterial(material: MulchType): MulchType {
  const { available: _availability, ...snapshot } = material;
  return structuredClone(snapshot);
}
