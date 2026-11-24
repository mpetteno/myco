type Props = { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; disabled?: boolean };

export function EditHistoryActions({ canUndo, canRedo, onUndo, onRedo, disabled = false }: Props) {
  return <div className="flex shrink-0">
    {([{ label: 'Undo', available: canUndo, action: onUndo, flip: false }, { label: 'Redo', available: canRedo, action: onRedo, flip: true }]).map(({ label, available, action, flip }) =>
      <button key={label} type="button" aria-label={label} title={label} disabled={disabled || !available} onClick={action}
        className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 rounded-lg px-2 text-sm focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-40">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={flip ? { transform: 'scaleX(-1)' } : undefined}><path d="M9 4 3 10l6 6M3 10h11a7 7 0 0 1 7 7v3" /></svg>
        <span className="hidden sm:inline">{label}</span>
      </button>)}
  </div>;
}
