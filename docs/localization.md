# Localization

English is the initial language. The recording actions, garden/bed recording
forms, field labels, guidance, validation, recording status and history-service
errors use the shared localization layer in `src/shared/i18n/`. Both each form's
heading and its confirmation button use the same translation key:

- `record.garden`: Record garden changes
- `record.bed`: Record bed changes

Other screens still use English text and can move to this catalogue as they are
updated. No additional language or language picker is shipped in this step.

## Add a language

Create a language file beside `en.ts`, using stable keys rather than English
sentences as identifiers. `Messages` checks the keys; partial translations are
allowed and missing entries fall back to English.

```ts
import type { Messages } from './i18n';

export const it = {
  'record.garden': 'Registra modifiche al giardino',
  'record.bed': 'Registra modifiche all’aiuola',
} satisfies Messages;
```

Import the new catalogue in `i18n.ts` and register it in `catalogues`, for example
`{ en, it }`. The root `I18nProvider` uses the browser language when no locale is
specified. Regional locales resolve to registered parent languages (`it-IT` to
`it`); unsupported or invalid locales resolve to English. The provider sets the
document's `lang` attribute to the resolved locale. A future language preference
can supply `<I18nProvider locale={selectedLocale}>` without changing components.

Components call `const { t, locale } = useI18n()` and render a typed key:

```tsx
<h3>{t('record.garden')}</h3>
```

Keep full sentences in the catalogue. Use named placeholders for values:
`t('record.gardenDescription', { bedAction: t('record.bed') })`. Translations are
rendered as React text, never HTML. `createI18n(locale).t` is available outside
React; validators accept a translator and otherwise use English. History errors
retain a translation key alongside their English message and conflict flag so
recording forms can display them in the active language.

The locale affects interface text only. User names, garden/bed names, entered
record titles and notes, saved history, dates and centimetre coordinates are not
translated or rewritten. Changing locale preserves in-progress form values.
The garden record's initial suggested title is localized when the form opens;
a language change does not replace an existing draft title.

Tests cover regional resolution, missing keys, interpolation, matching action
labels, translated validation/errors, pending submissions, changing locales
without losing draft fields and unchanged recorded payloads. Test translations
are fixtures, not additional shipped languages.
