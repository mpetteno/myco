import { useRef, useState } from 'react';
import { Button } from '../../shared/ui/Button';
import { Sheet } from '../../shared/ui/Sheet';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { GardenStorageError } from '../gardens/gardenErrors';

export function CatalogueRemovalDialog({ name, removesGuidance = false, removesCropGuidance = false, onRemove, onRemoved, onCancel }: {
  name: string; removesGuidance?: boolean; removesCropGuidance?: boolean; onRemove: () => Promise<void>; onRemoved: () => void; onCancel: () => void;
}) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function remove() {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await onRemove(); onRemoved(); }
    catch (problem) {
      setError(problem instanceof GardenStorageError && problem.translationKey ? t(problem.translationKey) : t('catalogue.removalFailed'));
    } finally { busy.current = false; setPending(false); }
  }
  return <Sheet title={t('catalogue.removeTitle', { name })} dismissible={!pending} onClose={onCancel}>
    <div className="space-y-4">
      <p>{t('catalogue.removeDescription')}</p>
      {removesGuidance && <p>{t('catalogue.removeCultivarGuidance')}</p>}
      {removesCropGuidance && <p>{t('catalogue.removeCropGuidance')}</p>}
      <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
      <Button type="button" variant="danger" disabled={pending} onClick={() => void remove()}>{t(pending ? 'catalogue.removing' : 'catalogue.confirmRemove')}</Button>
      <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>{t('catalogue.cancelRemoval')}</Button>
    </div>
  </Sheet>;
}
