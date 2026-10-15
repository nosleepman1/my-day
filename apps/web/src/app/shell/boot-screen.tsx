import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

/** Écran de démarrage pendant le chargement de `/me` : jamais un flash de la page de connexion (FRONTEND.md §5). */
export function BootScreen(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-4"
    >
      <p className="text-h2 font-semibold tracking-tight text-foreground">{t('appName')}</p>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
      </div>
      <span className="sr-only">{t('states.booting')}</span>
    </div>
  );
}
