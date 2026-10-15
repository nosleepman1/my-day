import type { JSX } from 'react';

import { ErrorState, LoadingState } from '@/components/data-display/states';

import { useMe, usePreferences } from '../api/me.api';
import { EmailCard } from '../components/email-card';
import { LoginHistoryCard } from '../components/login-history-card';
import { PasswordCard } from '../components/password-card';
import { SessionsCard } from '../components/sessions-card';

/** `/settings/security` : adresse, mot de passe, sessions, historique (PHASE-02 T9). */
export function SecurityPage(): JSX.Element {
  const me = useMe();
  const preferences = usePreferences();
  if (me.isPending || preferences.isPending) return <LoadingState />;
  if (me.isError) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  if (preferences.isError)
    return <ErrorState error={preferences.error} onRetry={() => void preferences.refetch()} />;
  const { timezone } = preferences.data.data;
  return (
    <div className="flex flex-col gap-4">
      <EmailCard currentEmail={me.data.data.email} />
      <PasswordCard />
      <SessionsCard timezone={timezone} />
      <LoginHistoryCard timezone={timezone} />
    </div>
  );
}
