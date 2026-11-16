import { I18nProvider } from './shared/i18n/I18nProvider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/styles.css';
import { initializeTheme } from './features/appearance/theme';

initializeTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider><App /></I18nProvider>
  </StrictMode>,
);
