import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { useLiveness } from '../api/health.api';

/** Page technique de PHASE-00 : vérifie la chaîne front → proxy /api → API. */
export function SystemStatusPage(): JSX.Element {
  const { t } = useTranslation();
  const liveness = useLiveness();
  const message = liveness.isPending
    ? t('system.checking')
    : liveness.isError
      ? t('system.unreachable')
      : t('system.ok');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{t('appName')}</h1>
      <p role="status" aria-live="polite" className="text-base">
        {message}
      </p>
    </main>
  );
}
