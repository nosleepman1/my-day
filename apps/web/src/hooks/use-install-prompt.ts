import { useCallback, useEffect, useState } from 'react';

/** Événement non standard de Chrome et Android (absent des types DOM). */
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

/**
 * Invite d'installation discrète (FRONTEND.md §10.1) : `beforeinstallprompt` est conservé et rejoué
 * à la demande ; `null` quand le navigateur ne propose pas l'installation.
 */
export function useInstallPrompt(): (() => void) | null {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const capture = (event: Event): void => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const installed = (): void => {
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  const install = useCallback(() => {
    void deferred?.prompt();
    setDeferred(null);
  }, [deferred]);
  return deferred === null ? null : install;
}
