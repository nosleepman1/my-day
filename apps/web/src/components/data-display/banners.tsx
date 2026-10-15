import { Archive, CloudOff, RefreshCw, type LucideIcon } from 'lucide-react';
import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';

type BannerProps = Readonly<{
  icon: LucideIcon;
  tone: 'muted' | 'warning' | 'info';
  children: ReactNode;
  action?: ReactNode;
}>;

const TONES = {
  muted: 'bg-surface-muted text-foreground',
  warning: 'bg-warning-surface text-warning',
  info: 'bg-info-surface text-info',
} as const;

function Banner({ icon: Icon, tone, children, action }: BannerProps): JSX.Element {
  return (
    <div role="status" className={cn('flex items-center gap-3 rounded-md px-3 py-2 text-small', TONES[tone])}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <p className="flex-1">{children}</p>
      {action}
    </div>
  );
}

type ActionBannerProps = Readonly<{ action?: ReactNode; message?: string }>;

/** Élément archivé : détail en lecture seule, action « Restaurer » fournie par l'écran (§6). */
export function ArchivedBanner({ action, message }: ActionBannerProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <Banner icon={Archive} tone="muted" action={action}>
      {message ?? t('states.archived')}
    </Banner>
  );
}

/** Données périmées ou synchronisation en cours. */
export function StaleBanner({ action, message }: ActionBannerProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <Banner icon={RefreshCw} tone="info" action={action}>
      {message ?? t('states.stale')}
    </Banner>
  );
}

/** Appareil hors ligne : les données affichées viennent du cache. */
export function OfflineBanner({ action, message }: ActionBannerProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <Banner icon={CloudOff} tone="warning" action={action}>
      {message ?? t('states.offline')}
    </Banner>
  );
}
