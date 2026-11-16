import { useI18n } from '../../shared/i18n/I18nProvider';
import { Button } from '../../shared/ui/Button';
import type { useGardenHistory } from '../history/useGardenHistory';

export function ActivityActions({ history }: { history: ReturnType<typeof useGardenHistory> }) {
  const { t } = useI18n();
  return <Button variant="secondary" disabled={history.loading || history.saving || !history.getCurrent().beds.length}
    onClick={() => history.setActivityForm(true)}>{t('record.bed')}</Button>;
}
