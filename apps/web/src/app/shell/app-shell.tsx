import { Suspense, useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import { OfflineBanner } from '@/components/data-display/banners';
import { LoadingState } from '@/components/data-display/states';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PendingCaptures, QuickCaptureSheet, useCaptureShortcut, useCaptureSync } from '@/features/capture';
import { useOnlineStatus } from '@/hooks/use-online-status';

import { useSession } from '../session/session';
import { useTheme } from '../theme';

import { BottomNav } from './bottom-nav';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

/** Thème de la session appliqué au premier rendu (préférence serveur, PHASE-02 §3). */
function useSessionTheme(): void {
  const { preferences } = useSession();
  const { setTheme } = useTheme();
  useEffect(() => {
    setTheme(preferences.theme);
  }, [preferences.theme, setTheme]);
}

/** Capture rapide du shell : ouverture (bouton, raccourci `N`) et rejeu de la file hors ligne du compte. */
function useShellCapture(ownerId: string) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const openCapture = (): void => {
    setCaptureOpen(true);
  };
  useCaptureShortcut(openCapture);
  useCaptureSync(ownerId);
  return { captureOpen, setCaptureOpen, openCapture };
}

/** Enveloppe des pages authentifiées : barre latérale (desktop), en-tête, contenu, barre du bas (mobile). */
export function AppShell(): JSX.Element {
  const { t } = useTranslation('nav');
  const { user, preferences } = useSession();
  const online = useOnlineStatus();
  const { captureOpen, setCaptureOpen, openCapture } = useShellCapture(user.id);
  const context = { role: user.role, enabledModules: preferences.enabledModules };
  useSessionTheme();

  return (
    <TooltipProvider>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('skipToContent')}
      </a>
      <div className="flex min-h-dvh">
        <Sidebar context={context} onCapture={openCapture} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 md:px-8 md:pb-8"
          >
            {!online && (
              <div className="mb-4">
                <OfflineBanner />
              </div>
            )}
            <PendingCaptures ownerId={user.id} />
            <Suspense fallback={<LoadingState />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
      <BottomNav context={context} onCapture={openCapture} />
      <QuickCaptureSheet
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        enabledModules={preferences.enabledModules}
        ownerId={user.id}
      />
    </TooltipProvider>
  );
}
