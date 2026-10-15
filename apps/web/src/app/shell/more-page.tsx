import { ChevronRight } from 'lucide-react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';

import { Badge } from '@/components/ui/misc';
import { DESKTOP_QUERY, useMediaQuery } from '@/hooks/use-media-query';

import { visibleEntries, type NavEntry } from '../navigation/registry';
import { useSession } from '../session/session';

function EntryList({ entries }: Readonly<{ entries: readonly NavEntry[] }>): JSX.Element {
  const { t } = useTranslation('nav');
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg bg-surface shadow-sm">
      {entries.map(({ key, path, icon: Icon }) => (
        <li key={key}>
          <Link to={path} className="flex min-h-12 items-center gap-3 px-4 text-body hover:bg-surface-muted">
            <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
            <span className="flex-1">{t(`entries.${key}`)}</span>
            <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Menu « Plus » mobile (DESIGN_SYSTEM.md §4.1) ; redirige vers l'accueil sur desktop (FRONTEND.md §9.1). */
export function MorePage(): JSX.Element {
  const { t } = useTranslation('nav');
  const { user, preferences } = useSession();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  if (desktop) return <Navigate to="/" replace />;
  const entries = visibleEntries({ role: user.role, enabledModules: preferences.enabledModules }).filter(
    (entry) => entry.inMoreMenu,
  );
  const devEntries = entries.filter((entry) => entry.section === 'dev');
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-h1">{t('moreTitle')}</h1>
      <EntryList entries={entries.filter((entry) => entry.section !== 'dev')} />
      {devEntries.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-caption text-zone-dev uppercase">
            {t('sections.dev')}
            <Badge tone="info">{t('adminBadge')}</Badge>
          </p>
          <EntryList entries={devEntries} />
        </div>
      )}
    </section>
  );
}
