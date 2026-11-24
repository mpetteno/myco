type Props = { label: string; onClick: () => void; disabled?: boolean; showLabel?: boolean };

export function BackButton({ label, onClick, disabled = false, showLabel = false }: Props) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
    className={`flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-green-600 disabled:cursor-default disabled:opacity-40 dark:text-stone-300 dark:hover:bg-stone-800 ${showLabel ? 'max-w-full px-3' : 'w-11'}`}>
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
    {showLabel && <span className="truncate">{label}</span>}
  </button>;
}
