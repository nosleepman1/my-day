import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Bandeau des environnements non productifs (staging, préversions Vercel) : on ne confond jamais un
 * environnement de test avec la production (PHASE-03 §6).
 */
export function EnvironmentBanner({ appEnv }: Readonly<{ appEnv: string | undefined }>): JSX.Element | null {
  const { t } = useTranslation();
  if (appEnv === undefined || appEnv === '' || appEnv === 'production') return null;
  return (
    <div role="note" className="bg-warning px-4 py-1 text-center text-caption font-semibold text-background">
      {t('environment.banner', { env: appEnv.toUpperCase() })}
    </div>
  );
}
