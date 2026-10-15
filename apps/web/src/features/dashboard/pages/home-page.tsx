import { CalendarCheck, Inbox, Wallet } from 'lucide-react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import type { SessionUser } from '@orbit/contracts';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const CARDS = [
  { key: 'today', icon: CalendarCheck },
  { key: 'money', icon: Wallet },
  { key: 'inbox', icon: Inbox },
] as const;

/** Accueil provisoire (PHASE-02) : salutation et cartes « à venir » ; le centre d'attention arrive en PHASE-07. */
export function HomePage({ user }: Readonly<{ user: SessionUser }>): JSX.Element {
  const { t } = useTranslation('home');
  const name = user.displayName.trim();
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-h1">{name === '' ? t('greetingAnonymous') : t('greeting', { name })}</h1>
        <p className="text-body text-muted-foreground">{t('subtitle')}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {CARDS.map(({ key, icon: Icon }) => (
          <Card key={key}>
            <CardHeader>
              <Icon aria-hidden="true" className="size-6 text-muted-foreground" />
              <CardTitle>{t(`cards.${key}`)}</CardTitle>
              <CardDescription>{t(`cards.${key}Body`)}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
