export type MonthWindow = { start_month: number; end_month: number };
export const monthInWindow = (month: number, start: number, end: number) => start <= end
  ? month >= start && month <= end : month >= start || month <= end;
export function normalizeWindows(windows: readonly MonthWindow[]): MonthWindow[] {
  const months = new Set<number>();
  for (const window of windows) {
    if (![window.start_month, window.end_month].every((month) => Number.isInteger(month) && month >= 1 && month <= 12)) throw new Error('Months must be between 1 and 12.');
    for (let month = 1; month <= 12; month++) if (monthInWindow(month, window.start_month, window.end_month)) months.add(month);
  }
  if (months.size === 12) return [{ start_month: 1, end_month: 12 }];
  const ranges: MonthWindow[] = [];
  for (let month = 1; month <= 12; month++) {
    if (!months.has(month) || months.has(month === 1 ? 12 : month - 1)) continue;
    let end = month;
    while (months.has(end % 12 + 1)) end = end % 12 + 1;
    ranges.push({ start_month: month, end_month: end });
  }
  return ranges;
}
export const monthName = (month: number, locale: string, format: 'short' | 'long' = 'short') =>
  new Intl.DateTimeFormat(locale, { month: format, timeZone: 'UTC' }).format(new Date(Date.UTC(2024, month - 1, 1)));
export function formatWindows(windows: readonly MonthWindow[], locale: string) {
  return normalizeWindows(windows).map((window) => window.start_month === window.end_month ? monthName(window.start_month, locale)
    : `${monthName(window.start_month, locale)}–${monthName(window.end_month, locale)}`).join('; ');
}
export function calendarNote(notes: string, windows: readonly MonthWindow[]) {
  const legacy = [...windows].sort((a,b) => a.start_month - b.start_month).map((w) => `${monthName(w.start_month, 'en')}${w.start_month === w.end_month ? '' : `-${monthName(w.end_month, 'en')}`}`).join('; ');
  return notes === legacy ? '' : notes;
}
