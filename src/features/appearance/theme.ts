export type Theme = 'light' | 'dark';
const storageKey = 'myco-theme';
const listeners = new Set<() => void>();
let preference: Theme | null = null;
let theme: Theme = 'light';
let media: MediaQueryList | undefined;
let initialized = false;

function savedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value === 'light' || value === 'dark' ? value : null;
  } catch { return null; }
}

function publish() {
  theme = preference ?? (media?.matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#28221c' : '#fffcf6');
  listeners.forEach((listener) => listener());
}

export function initializeTheme() {
  if (initialized) return;
  initialized = true;
  preference = savedTheme();
  media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener('change', () => { if (!preference) publish(); });
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === null) { preference = savedTheme(); publish(); }
  });
  publish();
}

export function getTheme(): Theme { initializeTheme(); return theme; }
export function subscribeTheme(listener: () => void) {
  initializeTheme(); listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function toggleTheme() {
  initializeTheme();
  preference = theme === 'dark' ? 'light' : 'dark';
  try { window.localStorage.setItem(storageKey, preference); } catch { /* Keep the toggle usable without storage. */ }
  publish();
}
