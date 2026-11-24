import { useI18n } from '../../shared/i18n/I18nProvider';
import { Button } from '../../shared/ui/Button';

type Props = { onPrevious?: () => void; onNext?: () => void };

export function CatalogueSiblingNavigation({ onPrevious, onNext }: Props) {
  const { t } = useI18n();
  return <nav aria-label={t('catalogue.browseEntries')} className="grid grid-cols-2 gap-2">
    <Button type="button" variant="secondary" disabled={!onPrevious} onClick={onPrevious}>{t('catalogue.previousEntry')}</Button>
    <Button type="button" variant="secondary" disabled={!onNext} onClick={onNext}>{t('catalogue.nextEntry')}</Button>
  </nav>;
}
