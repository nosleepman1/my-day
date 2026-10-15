import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';

import { authApi, useAuthMutation } from '../api/auth.api';

import { Notice } from './auth-layout';

/** Renvoi de l'e-mail de confirmation : réponse générique, que le compte existe ou non. */
export function ResendVerification({ email }: Readonly<{ email: string }>): JSX.Element {
  const { t } = useTranslation('auth');
  const resend = useAuthMutation(authApi.resendVerification);
  if (resend.isSuccess) return <Notice>{t('resend.done')}</Notice>;
  return (
    <div className="flex flex-col gap-2">
      <FormError error={resend.error} />
      <Button
        variant="secondary"
        disabled={resend.isPending || email.trim() === ''}
        onClick={() => {
          resend.mutate({ email });
        }}
      >
        {t('resend.action')}
      </Button>
    </div>
  );
}
