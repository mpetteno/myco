import { useI18n } from '../../shared/i18n/I18nProvider';

export function CatalogueDescription({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  return <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">{t(isAdmin ? 'catalogue.accessAdmin' : 'catalogue.accessReader')}</p>;
}
