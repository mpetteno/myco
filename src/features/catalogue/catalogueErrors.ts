import { GardenStorageError } from '../gardens/gardenErrors';

export function catalogueError(problem: unknown): GardenStorageError {
  if (problem instanceof GardenStorageError) return problem;
  const code = problem && typeof problem === 'object' && 'code' in problem ? problem.code : null;
  if (code === '42501') return new GardenStorageError('Only catalogue administrators can make changes. Refresh to check your access.');
  if (code === '40001') return new GardenStorageError('This entry changed. Refresh the catalogue before editing again.', true);
  if (code === '23505') return new GardenStorageError('This name, guidance entry or relationship already exists. Edit the existing entry instead.');
  if (code === '23503') return new GardenStorageError('A referenced family or plant type is no longer available. Refresh the catalogue.');
  if (code === '23514' || code === '22003') return new GardenStorageError('Check required fields, spacing, references and living-mulch eligibility.');
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST204') return new GardenStorageError('The plant catalogue is not available yet. Please contact the app administrator.');
  return new GardenStorageError('Could not reach the plant catalogue. Check your connection and try again.');
}
