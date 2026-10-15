import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';

const TABS = ['profile', 'preferences', 'modules', 'security', 'tags'] as const;

/** Paramètres : onglets en liens (chaque écran a sa route, PHASE-02 §6). */
export function SettingsLayout(): JSX.Element {
  const { t } = useTranslation('settings');
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-h1">{t('title')}</h1>
      <nav aria-label={t('title')} className="flex gap-1 overflow-x-auto rounded-md bg-surface-muted p-1">
        {TABS.map((tab) => (
          <NavLink
            key={tab}
            to={`/settings/${tab}`}
            className="inline-flex min-h-11 items-center rounded-sm px-3 text-small whitespace-nowrap text-muted-foreground aria-[current=page]:bg-surface aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
          >
            {t(`tabs.${tab}`)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </section>
  );
}
