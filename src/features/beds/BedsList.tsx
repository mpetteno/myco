import type { Bed } from './bed';

type BedsListProps = { beds: Bed[]; selectedBedId: string | null; onEdit: (id: string) => void };

export function BedsList({ beds, selectedBedId, onEdit }: BedsListProps) {
  if (!beds.length) return <p className="py-4 text-sm text-stone-600 dark:text-stone-400">No beds yet. Close this panel and choose Add bed to create one.</p>;
  return (
    <ul className="space-y-2">
      {beds.map((bed) => (
        <li key={bed.id}>
          <button type="button" onClick={() => onEdit(bed.id)} aria-label={`Edit ${bed.name}`}
            aria-pressed={selectedBedId === bed.id}
            className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-lg border border-stone-200 p-3 text-left hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-green-600 aria-pressed:border-amber-700 dark:border-stone-700 dark:hover:bg-stone-800">
            <span aria-hidden="true" className="size-4 shrink-0 rounded-sm bg-amber-800" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{bed.name}</span>
              <span className="block text-xs text-stone-600 dark:text-stone-400">{bed.widthCm} × {bed.lengthCm} cm</span>
            </span>
            <span className="text-xs">Edit</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
