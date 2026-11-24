import type { TranslationKey } from '../../shared/i18n/i18n';

export class GardenStorageError extends Error {
  constructor(message: string, public readonly conflict = false, public readonly translationKey?: TranslationKey) { super(message); }
}

export function gardenStorageError(error: unknown): GardenStorageError {
  if (error instanceof GardenStorageError) return error;
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST204' || code === 'PGRST202') {
    return new GardenStorageError('Garden storage is not available yet. Please contact the app owner.');
  }
  if (code === '42501') return new GardenStorageError('You do not have permission to access this garden.');
  if (code === '23514') return new GardenStorageError('The garden layout, planting or mulch plan is invalid. Check dimensions, positions, spacing and layers.');
  return new GardenStorageError('Could not reach garden storage. Check your connection and try again.');
}
