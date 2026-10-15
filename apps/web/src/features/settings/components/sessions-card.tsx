import { MonitorSmartphone } from 'lucide-react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import type { SessionSummary } from '@orbit/contracts';

import { ErrorState, LoadingState } from '@/components/data-display/states';
import { FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/misc';
import { formatInstant } from '@/lib/dates';

import { useRevokeSessions, useSessions } from '../api/me.api';

type SessionRowProps = Readonly<{
  session: SessionSummary;
  timezone: string;
  onRevoke: () => void;
  busy: boolean;
}>;

function SessionRow({ session, timezone, onRevoke, busy }: SessionRowProps): JSX.Element {
  const { t } = useTranslation('settings');
  const device = session.device ?? t('security.sessions.unknownDevice');
  return (
    <li className="flex items-center gap-3 py-3">
      <MonitorSmartphone aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-body">
          {device}
          {session.current && <Badge tone="success">{t('security.sessions.current')}</Badge>}
        </p>
        <p className="text-caption text-muted-foreground">
          {t('security.sessions.lastSeen', { date: formatInstant(session.lastSeenAt, timezone) })}
          {session.ip === null ? '' : ` · ${session.ip}`}
        </p>
      </div>
      {!session.current && (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          aria-label={t('security.sessions.revokeLabel', { device })}
          onClick={onRevoke}
        >
          {t('security.sessions.revoke')}
        </Button>
      )}
    </li>
  );
}

/** Sessions actives : révocation unitaire ou de toutes les autres (PHASE-02 §3). */
export function SessionsCard({ timezone }: Readonly<{ timezone: string }>): JSX.Element {
  const { t } = useTranslation('settings');
  const sessions = useSessions();
  const revoke = useRevokeSessions();
  const others = sessions.data?.data.filter((session) => !session.current) ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('security.sessions.title')}</CardTitle>
      </CardHeader>
      {sessions.isPending && <LoadingState rows={2} />}
      {sessions.isError && (
        <ErrorState compact error={sessions.error} onRetry={() => void sessions.refetch()} />
      )}
      {sessions.isSuccess && (
        <>
          <ul className="divide-y divide-border">
            {sessions.data.data.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                timezone={timezone}
                busy={revoke.isPending}
                onRevoke={() => {
                  revoke.mutate({ sessionId: session.id });
                }}
              />
            ))}
          </ul>
          <FormError error={revoke.error} />
          {others.length === 0 ? (
            <p className="text-small text-muted-foreground">{t('security.sessions.empty')}</p>
          ) : (
            <Button
              variant="secondary"
              className="self-start"
              disabled={revoke.isPending}
              onClick={() => {
                revoke.mutate('others');
              }}
            >
              {t('security.sessions.revokeOthers')}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
