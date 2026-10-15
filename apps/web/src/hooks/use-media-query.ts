import { useSyncExternalStore } from 'react';

/** Point de rupture desktop (DESIGN_SYSTEM.md §4.2 : barre latérale à partir de 768 px). */
export const DESKTOP_QUERY = '(min-width: 768px)';

/** État d'une media query, mis à jour en direct (barre latérale, feuille ou dialogue de capture). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', notify);
      return () => {
        media.removeEventListener('change', notify);
      };
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
