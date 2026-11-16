import { english } from '../../shared/i18n/i18n';
import type { Translator } from '../../shared/i18n/i18n';
import type { GardenEventDetails } from '../history/gardenHistory';
import { validateEventDetails } from '../history/gardenHistory';

export type ActivityDetails = GardenEventDetails & { bedId: string };
export function validateActivity(details: ActivityDetails, t: Translator = english) {
  return validateEventDetails(details, t) ?? (!details.bedId ? t('validation.bed') : null);
}
