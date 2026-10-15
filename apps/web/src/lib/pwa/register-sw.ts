import type { i18n } from 'i18next';
import { toast } from 'sonner';
import { Workbox } from 'workbox-window';

const SW_URL = '/sw.js';

/**
 * Enregistre le service worker (production uniquement). Quand une nouvelle version attend, un toast
 * propose « Mettre à jour » : jamais de rechargement forcé, une saisie en cours serait perdue.
 */
export function registerServiceWorker(i18n: i18n): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const workbox = new Workbox(SW_URL);
  workbox.addEventListener('waiting', () => {
    toast(i18n.t('pwa.updateAvailable'), {
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: i18n.t('pwa.update'),
        onClick: () => {
          workbox.addEventListener('controlling', () => {
            window.location.reload();
          });
          workbox.messageSkipWaiting();
        },
      },
    });
  });
  void workbox.register();
}
