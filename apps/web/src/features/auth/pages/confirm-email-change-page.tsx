import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { authApi, useAuthMutation } from '../api/auth.api';
import { AuthLayout, BackToLogin, Notice, useFragmentToken } from '../components/auth-layout';

import { useOnce } from './verify-email-page';

/** Confirmation d'un changement d'adresse (lien envoyé à la nouvelle adresse). */
export function ConfirmEmailChangePage(): JSX.Element {
  const { t } = useTranslation('auth');
  const token = useFragmentToken();
  const confirm = useAuthMutation(authApi.confirmEmailChange);
  const { mutate } = confirm;
  useOnce(() => {
    if (token !== null) mutate({ token });
  });
  return (
    <AuthLayout title={t('emailChange.title')} footer={<BackToLogin />}>
      {confirm.isPending && token !== null && <Notice tone="info">{t('emailChange.pending')}</Notice>}
      {confirm.isSuccess && <Notice>{t('emailChange.done')}</Notice>}
      {(token === null || confirm.isError) && <Notice tone="info">{t('emailChange.invalid')}</Notice>}
    </AuthLayout>
  );
}
