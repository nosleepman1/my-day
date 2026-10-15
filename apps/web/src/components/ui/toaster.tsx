// Styles de Sonner intégrés au bundle CSS : la CSP `style-src 'self'` bloque la balise <style> que la
// bibliothèque injecte à l'exécution (SECURITY.md §3.10), sans quoi les toasts perdraient leur mise en page.
import 'sonner/dist/styles.css';

import type { JSX } from 'react';
import { Toaster as Sonner } from 'sonner';

import { useTheme } from '@/app/theme';

/** Toasts (DESIGN_SYSTEM.md §7) : en haut, au-dessus de la barre du bas, aux couleurs du thème. */
export function Toaster(): JSX.Element {
  const { theme } = useTheme();
  return (
    <Sonner
      position="top-center"
      theme={theme === 'DARK' ? 'dark' : theme === 'LIGHT' ? 'light' : 'system'}
      toastOptions={{ classNames: { toast: 'rounded-md bg-surface text-foreground shadow-md text-small' } }}
    />
  );
}
