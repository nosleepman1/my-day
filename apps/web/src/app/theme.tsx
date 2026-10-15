import { createContext, type JSX, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

/** Valeurs de `user_preferences.theme` (API `PreferencesSchema`). */
export type ThemePreference = 'SYSTEM' | 'LIGHT' | 'DARK';

const STORAGE_KEY = 'orbit:theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const STORED_VALUE: Readonly<Record<ThemePreference, string>> = {
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark',
};

function prefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Pose la classe `dark` et mémorise le choix pour public/theme-init.js (évite le flash au rechargement). */
export function applyTheme(preference: ThemePreference): void {
  const dark = preference === 'DARK' || (preference === 'SYSTEM' && prefersDark());
  document.documentElement.classList.toggle('dark', dark);
  try {
    window.localStorage.setItem(STORAGE_KEY, STORED_VALUE[preference]);
  } catch {
    // Stockage indisponible : le thème s'applique quand même pour cette page.
  }
}

function storedPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark') return 'DARK';
    if (stored === 'light') return 'LIGHT';
  } catch {
    // Stockage indisponible : préférence système.
  }
  return 'SYSTEM';
}

type ThemeContextValue = Readonly<{ theme: ThemePreference; setTheme: (theme: ThemePreference) => void }>;

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Thème clair, sombre ou automatique (DESIGN_SYSTEM.md §2) ; « automatique » suit le système en direct. */
export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>): JSX.Element {
  const [theme, setTheme] = useState<ThemePreference>(storedPreference);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'SYSTEM') return undefined;
    const media = window.matchMedia(DARK_QUERY);
    const follow = (): void => {
      applyTheme('SYSTEM');
    };
    media.addEventListener('change', follow);
    return () => {
      media.removeEventListener('change', follow);
    };
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === null) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
