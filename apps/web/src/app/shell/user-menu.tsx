import { Download, LogOut, Monitor, Moon, Settings, Sun, UserRound } from 'lucide-react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { useLogout, useUpdatePreferences } from '@/lib/http/session.api';

import { useSession } from '../session/session';
import { useTheme, type ThemePreference } from '../theme';

const THEME_ICONS = { SYSTEM: Monitor, LIGHT: Sun, DARK: Moon } as const;

/** Choix du thème : appliqué tout de suite, puis enregistré dans les préférences. */
function ThemeItems(): JSX.Element {
  const { t } = useTranslation('nav');
  const { setTheme } = useTheme();
  const updatePreferences = useUpdatePreferences();
  const chooseTheme = (theme: ThemePreference): void => {
    setTheme(theme);
    updatePreferences.mutate({ theme });
  };
  return (
    <>
      {(['SYSTEM', 'LIGHT', 'DARK'] as const).map((theme) => {
        const Icon = THEME_ICONS[theme];
        return (
          <DropdownMenuItem
            key={theme}
            onSelect={() => {
              chooseTheme(theme);
            }}
          >
            <Icon aria-hidden="true" />
            {t(`theme.${theme}`)}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}

/** Menu du compte : e-mail, thème, paramètres, déconnexion (DESIGN_SYSTEM.md §4.2, pied de barre). */
export function UserMenu(): JSX.Element {
  const { t } = useTranslation(['nav', 'common']);
  const { user } = useSession();
  const install = useInstallPrompt();
  const logout = useLogout();
  const navigate = useNavigate();
  const signOut = (): void => {
    logout.mutate(undefined, { onSettled: () => void navigate('/login', { replace: true }) });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('userMenu')}
        className="inline-flex size-11 items-center justify-center rounded-full bg-surface-muted text-foreground"
      >
        <UserRound aria-hidden="true" className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="max-w-64 truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ThemeItems />
        <DropdownMenuSeparator />
        {install !== null && (
          <DropdownMenuItem onSelect={install}>
            <Download aria-hidden="true" />
            {t('common:pwa.installAction')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => void navigate('/settings')}>
          <Settings aria-hidden="true" />
          {t('entries.settings')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <LogOut aria-hidden="true" />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
