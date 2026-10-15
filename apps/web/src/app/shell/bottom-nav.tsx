import { Menu, Plus } from 'lucide-react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import { cn } from '@/lib/cn';

import { bottomNavSlots, HOME_ENTRY, type NavContext, type NavEntry } from '../navigation/registry';

const ITEM_CLASS =
  'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 text-caption text-muted-foreground aria-[current=page]:text-primary';

function Tab({ entry, label }: Readonly<{ entry: NavEntry; label: string }>): JSX.Element {
  const Icon = entry.icon;
  return (
    <NavLink to={entry.path} end={entry.path === '/'} className={ITEM_CLASS}>
      <Icon aria-hidden="true" className="size-5" />
      <span>{label}</span>
    </NavLink>
  );
}

type BottomNavProps = Readonly<{ context: NavContext; onCapture: () => void }>;

/** Barre du bas mobile (DESIGN_SYSTEM.md §4.1) : Accueil, Finances, +, Tâches, Plus ; libellés toujours visibles. */
export function BottomNav({ context, onCapture }: BottomNavProps): JSX.Element {
  const { t } = useTranslation('nav');
  const [second, fourth] = bottomNavSlots(context);
  const home = HOME_ENTRY;
  return (
    <nav
      aria-label={t('mobileNavigation')}
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-start border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <Tab entry={home} label={t('entries.home')} />
      {second === null ? (
        <span className="flex-1" />
      ) : (
        <Tab entry={second} label={t(`entries.${second.key}`)} />
      )}
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          aria-label={t('capture')}
          onClick={onCapture}
          className="-mt-5 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
        >
          <Plus aria-hidden="true" className="size-6" />
        </button>
      </div>
      {fourth === null ? (
        <span className="flex-1" />
      ) : (
        <Tab entry={fourth} label={t(`entries.${fourth.key}`)} />
      )}
      <NavLink to="/more" className={cn(ITEM_CLASS)}>
        <Menu aria-hidden="true" className="size-5" />
        <span>{t('more')}</span>
      </NavLink>
    </nav>
  );
}
