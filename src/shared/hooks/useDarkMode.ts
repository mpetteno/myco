import { useTheme } from '../../features/appearance/useTheme';

export function useDarkMode() {
  return useTheme().theme === 'dark';
}
