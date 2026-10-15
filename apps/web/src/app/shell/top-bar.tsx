import { Bell, Search } from 'lucide-react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { UserMenu } from './user-menu';

function ShellButton({
  label,
  hint,
  icon: Icon,
}: Readonly<{ label: string; hint: string; icon: typeof Search }>): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-describedby={undefined}
          aria-disabled="true"
          className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground"
        >
          <Icon aria-hidden="true" className="size-5" />
          <span className="sr-only">{hint}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

/** En-tête : recherche (active en PHASE-07), notifications (PHASE-08), menu du compte. */
export function TopBar(): JSX.Element {
  const { t } = useTranslation(['nav', 'common']);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur">
      <p className="flex-1 text-h3 font-semibold tracking-tight md:invisible">{t('common:appName')}</p>
      <ShellButton label={t('search')} hint={t('searchSoon')} icon={Search} />
      <ShellButton label={t('notifications')} hint={t('notificationsSoon')} icon={Bell} />
      <UserMenu />
    </header>
  );
}
