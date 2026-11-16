import { useSyncExternalStore } from 'react';
import { getTheme, subscribeTheme, toggleTheme } from './theme';

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme);
  return { theme, toggleTheme };
}
