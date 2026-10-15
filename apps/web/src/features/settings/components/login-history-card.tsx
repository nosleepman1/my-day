import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInstant } from '@/lib/dates';

import { useLoginEvents } from '../api/me.api';

const KNOWN_EVENTS = new Set([
  'LOGIN_SUCCEEDED',
  'LOGIN_FAILED',
  'LOGOUT',
  'ACCOUNT_LOCKED',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET',
  'PASSWORD_RESET_REQUESTED',
  'REAUTH_SUCCEEDED',
  'REAUTH_FAILED',
  'EMAIL_CHANGED',
  'SESSION_REVOKED',
]);

/** Historique de connexion paginé par curseur (`GET /me/login-events`), IP tronquée. */
export function LoginHistoryCard({ timezone }: Readonly<{ timezone: string }>): JSX.Element {
  const { t } = useTranslation('settings');
  const events = useLoginEvents();
  const items = events.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('security.history.title')}</CardTitle>
      </CardHeader>
      {events.isPending && <LoadingState rows={3} />}
      {events.isError && <ErrorState compact error={events.error} onRetry={() => void events.refetch()} />}
      {events.isSuccess && items.length === 0 && <EmptyState compact title={t('security.history.empty')} />}
      {items.length > 0 && (
        <ul className="divide-y divide-border">
          {items.map((event) => (
            <li key={event.id} className="flex flex-col py-2">
              <span className="text-body">
                {t(
                  `security.history.events.${KNOWN_EVENTS.has(event.eventType) ? event.eventType : 'other'}` as 'security.history.events.other',
                )}
              </span>
              <span className="text-caption text-muted-foreground">
                {formatInstant(event.occurredAt, timezone)}
                {event.device === null ? '' : ` · ${event.device}`}
                {event.ip === null ? '' : ` · ${event.ip}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {events.hasNextPage && (
        <Button
          variant="ghost"
          className="self-start"
          disabled={events.isFetchingNextPage}
          onClick={() => void events.fetchNextPage()}
        >
          {t('security.history.more')}
        </Button>
      )}
    </Card>
  );
}
