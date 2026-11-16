import { GardenStorageError } from '../gardens/gardenErrors';

export function mulchCatalogueError(problem: unknown): GardenStorageError {
  if (problem instanceof GardenStorageError) return problem;
  const code = problem && typeof problem === 'object' && 'code' in problem ? problem.code : null;
  if (code === '42501') return new GardenStorageError('Only catalogue administrators can make changes. Refresh to check your access.');
  if (code === '23505') return new GardenStorageError('A mulch type with this name already exists. Edit the existing entry instead.');
  if (code === '23514' || code === '22001') return new GardenStorageError('Check the mulch name and notes.');
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST204') return new GardenStorageError('The mulch catalogue is not available yet. Please contact the app administrator.');
  return new GardenStorageError('Could not reach the mulch catalogue. Check your connection and try again.');
}
