import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, Outlet, useLocation, useSearchParams } from 'react-router';

import type { UserModule } from '@orbit/contracts';

import { ErrorState, ModuleDisabledState, NotFoundState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/http/client';
import { useMe, usePreferences } from '@/lib/http/session.api';

import { loginPathFor, safeNextPath, SessionContext, useSession } from '../session/session';
import { BootScreen } from '../shell/boot-screen';

function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** Session obligatoire : charge `/me` et les préférences, sinon `/login?next=` (FRONTEND.md §9.2). */
export function RequireAuth(): JSX.Element {
  const location = useLocation();
  const me = useMe();
  const preferences = usePreferences(me.isSuccess);
  if (me.isError) {
    if (isUnauthenticated(me.error)) {
      return <Navigate to={loginPathFor(`${location.pathname}${location.search}`)} replace />;
    }
    return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  }
  if (preferences.isError) {
    return <ErrorState error={preferences.error} onRetry={() => void preferences.refetch()} />;
  }
  if (me.isPending || preferences.isPending) return <BootScreen />;
  return (
    <SessionContext value={{ user: me.data.data, preferences: preferences.data.data }}>
      <Outlet />
    </SessionContext>
  );
}

/** Pages publiques d'authentification : un utilisateur connecté repart vers `next` ou l'accueil. */
export function PublicOnly(): JSX.Element {
  const [params] = useSearchParams();
  const me = useMe();
  if (me.isPending) return <BootScreen />;
  if (me.isSuccess) return <Navigate to={safeNextPath(params.get('next'))} replace />;
  return <Outlet />;
}

/** Onboarding non terminé → `/onboarding` (PHASE-02 §3). */
export function RequireOnboarding(): JSX.Element {
  const { preferences } = useSession();
  if (preferences.onboardingCompletedAt === null) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

function SettingsLink({ to }: Readonly<{ to: string }>): JSX.Element {
  const { t } = useTranslation();
  return (
    <Button asChild variant="secondary">
      <Link to={to}>{t('actions.openSettings')}</Link>
    </Button>
  );
}

function HomeLink(): JSX.Element {
  const { t } = useTranslation();
  return (
    <Button asChild variant="secondary">
      <Link to="/">{t('actions.backHome')}</Link>
    </Button>
  );
}

/** Masque le contenu d'un module désactivé (ADR-024) ; utilisable en élément de route ou en enveloppe. */
export function ModuleGate({
  module,
  children,
}: Readonly<{ module: UserModule; children?: ReactNode }>): JSX.Element {
  const { preferences } = useSession();
  if (!preferences.enabledModules.includes(module)) {
    return <ModuleDisabledState action={<SettingsLink to="/settings/modules" />} />;
  }
  return <>{children ?? <Outlet />}</>;
}

/** Zone ADMIN : « Introuvable » pour un USER, sans indice d'existence (FRONTEND.md §9.2). */
export function RoleGate({ children }: Readonly<{ children?: ReactNode }>): JSX.Element {
  const { user } = useSession();
  if (user.role !== 'ADMIN') return <NotFoundState action={<HomeLink />} />;
  return <>{children ?? <Outlet />}</>;
}

/** Page 404 de l'application. */
export function NotFoundPage(): JSX.Element {
  return <NotFoundState action={<HomeLink />} />;
}
