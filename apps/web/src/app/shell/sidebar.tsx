import { Plus } from 'lucide-react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';
import { cn } from '@/lib/cn';

import { SECTION_ORDER, visibleEntries, type NavContext } from '../navigation/registry';

type SidebarProps = Readonly<{ context: NavContext; onCapture: () => void }>;

/** Barre latérale desktop (DESIGN_SYSTEM.md §4.2), sections dérivées du registre de navigation. */
export function Sidebar({ context, onCapture }: SidebarProps): JSX.Element {
  const { t } = useTranslation(['nav', 'common']);
  const entries = visibleEntries(context);
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-surface p-4 md:flex">
      <p className="px-2 text-h3 font-semibold tracking-tight">{t('common:appName')}</p>
      <Button onClick={onCapture} className="justify-start" aria-keyshortcuts="N">
        <Plus aria-hidden="true" />
        {t('captureShort')}
      </Button>
      <nav aria-label={t('mainNavigation')} className="flex flex-col gap-4">
        {SECTION_ORDER.map((section) => {
          const items = entries.filter((entry) => entry.section === section);
          if (items.length === 0) return null;
          return (
            <div key={section} className="flex flex-col gap-1">
              <p
                className={cn(
                  'flex items-center gap-2 px-2 text-caption text-muted-foreground uppercase',
                  section === 'dev' && 'text-zone-dev',
                )}
              >
                {t(`sections.${section}`)}
                {section === 'dev' && <Badge tone="info">{t('adminBadge')}</Badge>}
              </p>
              {items.map(({ key, path, icon: Icon }) => (
                <NavLink
                  key={key}
                  to={path}
                  end={path === '/' || path === '/finance'}
                  className="flex min-h-10 items-center gap-3 rounded-md px-2 text-body text-foreground hover:bg-surface-muted aria-[current=page]:bg-surface-muted aria-[current=page]:text-primary"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {t(`entries.${key}`)}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
