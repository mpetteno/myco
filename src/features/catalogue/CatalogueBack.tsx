import { useGuardedBack } from '../../shared/navigation/WorkspaceNavigation';
import { BackButton } from '../../shared/ui/BackButton';
import { usePageBackAction, usePageBackLabel } from '../../shared/navigation/PageBackNavigation';

export function CatalogueBack({ onBack, disabled = false, label }: { onBack: () => void; disabled?: boolean; label?: string }) {
  const back = useGuardedBack(onBack);
  const scopedLabel = usePageBackLabel();
  const destination = label ?? scopedLabel ?? 'Back to catalogue';
  const inHeader = usePageBackAction({ label: destination, disabled, onClick: back });
  return inHeader ? null : <BackButton label={destination} disabled={disabled} onClick={back} showLabel />;
}
