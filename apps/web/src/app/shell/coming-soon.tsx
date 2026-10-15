import { Hourglass } from 'lucide-react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/data-display/states';

/** Page d'un module pas encore livré : la route existe déjà, le contenu arrive en phase `phase`. */
export function ComingSoon({ phase }: Readonly<{ phase: number }>): JSX.Element {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={Hourglass}
      title={t('states.comingSoonTitle')}
      body={t('states.comingSoonBody', { phase: String(phase).padStart(2, '0') })}
    />
  );
}
