import { AlertTriangle, Ban, Inbox, SearchX, ToggleLeft, WifiOff, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type JSX, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { displayCodeOf, requestIdOf } from '@/lib/http/api-error-message';
import { useErrorText } from '@/lib/i18n/use-error-text';

/** Délai avant d'afficher un squelette : pas de clignotement sur une réponse rapide (DESIGN_SYSTEM.md §6). */
export const LOADING_DELAY_MS = 150;

type LoadingStateProps = Readonly<{ rows?: number; label?: string; className?: string }>;

/** Squelettes à la forme d'une liste, après 150 ms ; annoncé aux lecteurs d'écran. */
export function LoadingState({ rows = 3, label, className }: LoadingStateProps): JSX.Element {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, LOADING_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col gap-3', className)}>
      <span className="sr-only">{label ?? t('states.loading')}</span>
      {visible &&
        Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}
    </div>
  );
}

type StateLayoutProps = Readonly<{
  icon: LucideIcon;
  title: string;
  body?: string | undefined;
  action?: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  role?: 'alert' | 'status';
}>;

function StateLayout({
  icon: Icon,
  title,
  body,
  action,
  footer,
  compact = false,
  role,
}: StateLayoutProps): JSX.Element {
  return (
    <div
      role={role}
      className={cn('flex flex-col items-center gap-3 text-center', compact ? 'py-4' : 'px-4 py-12')}
    >
      <Icon aria-hidden="true" className={cn('text-muted-foreground', compact ? 'size-8' : 'size-12')} />
      <p className="text-h3 text-foreground">{title}</p>
      {body !== undefined && <p className="max-w-prose text-small text-muted-foreground">{body}</p>}
      {action}
      {footer}
    </div>
  );
}

type EmptyStateProps = Readonly<{
  title?: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
  icon?: LucideIcon;
}>;

/** Liste vide : une phrase, une explication facultative, une action principale (§5.7). */
export function EmptyState({ title, body, action, compact, icon = Inbox }: EmptyStateProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <StateLayout
      icon={icon}
      title={title ?? t('states.empty')}
      body={body}
      action={action}
      compact={compact ?? false}
    />
  );
}

type ErrorStateProps = Readonly<{ error: unknown; onRetry?: () => void; compact?: boolean }>;

/** Erreur de chargement : réseau ou serveur, avec réessai et référence support (§5.8). */
export function ErrorState({ error, onRetry, compact }: ErrorStateProps): JSX.Element {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const code = displayCodeOf(error);
  const requestId = requestIdOf(error);
  const isNetwork = code === 'NETWORK';
  return (
    <StateLayout
      role="alert"
      icon={isNetwork ? WifiOff : AlertTriangle}
      title={isNetwork ? t('states.networkTitle') : t('states.errorTitle')}
      body={errorText(code, 0)}
      compact={compact ?? false}
      action={
        onRetry === undefined ? undefined : (
          <Button variant="secondary" onClick={onRetry}>
            {t('actions.retry')}
          </Button>
        )
      }
      footer={
        requestId === undefined ? undefined : (
          <p className="text-caption text-muted-foreground">{t('states.requestId', { id: requestId })}</p>
        )
      }
    />
  );
}

type NavigationStateProps = Readonly<{ action?: ReactNode }>;

/** Accès refusé (403 hors zone Dev, §6). */
export function ForbiddenState({ action }: NavigationStateProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <StateLayout
      icon={Ban}
      title={t('states.forbiddenTitle')}
      body={t('states.forbiddenBody')}
      action={action}
    />
  );
}

/** Introuvable : aussi rendu pour une zone ADMIN vue par un USER, sans indice (FRONTEND.md §9.2). */
export function NotFoundState({ action }: NavigationStateProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <StateLayout
      icon={SearchX}
      title={t('states.notFoundTitle')}
      body={t('states.notFoundBody')}
      action={action}
    />
  );
}

/** Module désactivé dans `enabled_modules` (ADR-024) : lien vers les paramètres. */
export function ModuleDisabledState({ action }: NavigationStateProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <StateLayout
      icon={ToggleLeft}
      title={t('states.moduleDisabledTitle')}
      body={t('states.moduleDisabledBody')}
      action={action}
    />
  );
}
