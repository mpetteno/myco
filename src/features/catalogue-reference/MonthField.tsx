import type { ComponentProps } from 'react';
import { SelectField } from '../../shared/ui/SelectField';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { monthName } from './calendarMonths';
export function MonthField(props: Omit<ComponentProps<typeof SelectField>, 'children'>) {
  const { locale } = useI18n();
  return <SelectField {...props}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{monthName(index + 1, locale, 'long')}</option>)}</SelectField>;
}
