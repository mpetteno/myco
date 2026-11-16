export type MulchType = { id: string; name: string; notes: string; version: number };
export type MulchDetails = Pick<MulchType, 'name' | 'notes'>;
export type MulchCatalogue = { types: MulchType[]; isAdmin: boolean };

export function validateMulchDetails(details: MulchDetails): string | null {
  if (!details.name.trim() || details.name.trim().length > 100) return 'Enter a name of 1 to 100 characters.';
  if (details.notes.length > 2000) return 'Keep notes within 2000 characters.';
  return null;
}
