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

export function livingMulchTypes(plants: Catalogue, categories: MulchCategory[]): MulchType[] {
  const category = categories.find((item) => item.code === 'living');
  if (!category) return [];
  const base = { notes: '', categoryId: category.id, categoryCode: 'living', available: true };
  const crops: MulchType[] = plants.plants.filter((crop) => crop.livingMulchEnabled).map((crop) => ({ ...base,
    id: `living:crop:${crop.id}`, name: crop.name, version: crop.version, plantTypeId: crop.id, cultivarId: null }));
  const cultivars: MulchType[] = (plants.cultivars ?? []).flatMap((cultivar) => {
    const crop = plants.plants.find((item) => item.id === cultivar.plantTypeId);
    if (!crop || !effectiveCultivar(crop, cultivar).livingMulchEnabled) return [];
    const fullName = `${crop.name} · ${cultivar.name}`;
    const name = fullName.length <= 100 ? fullName : `${crop.name.slice(0, 47)}… · ${cultivar.name.slice(0, 48)}…`;
    return [{ ...base, id: `living:cultivar:${cultivar.id}`, name, version: Math.max(crop.version, cultivar.version), plantTypeId: crop.id, cultivarId: cultivar.id }];
  });
  return [...crops, ...cultivars].sort((a, b) => a.name.localeCompare(b.name));
}
export function isLivingMulch(material: MulchType, categories: MulchCategory[] = []) {
  return material.categoryCode === 'living' || material.id.startsWith('living:')
    || categories.some((category) => category.id === material.categoryId && category.code === 'living');
}
