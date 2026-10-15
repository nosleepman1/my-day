import { useEffect, useRef, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { FormField } from '@/components/forms/form-field';
import { Input } from '@/components/ui/input';

import { authApi, useAuthMutation } from '../api/auth.api';
import { AuthLayout, BackToLogin, Notice, useFragmentToken } from '../components/auth-layout';
import { ResendVerification } from '../components/resend-verification';

/** Lance une seule fois l'action d'un lien à jeton (StrictMode monte deux fois les effets en dev). */
export function useOnce(action: () => void): void {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    action();
  }, [action]);
}

function ResendForm(): JSX.Element {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  return (
    <div className="flex flex-col gap-3">
      <FormField label={t('fields.email')}>
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.currentTarget.value);
          }}
        />
      </FormField>
      <ResendVerification email={email} />
    </div>
  );
}

/** Vérification d'e-mail : chargement, succès, jeton invalide avec renvoi (PHASE-02 §6). */
export function VerifyEmailPage(): JSX.Element {
  const { t } = useTranslation('auth');
  const token = useFragmentToken();
  const verify = useAuthMutation(authApi.verifyEmail);
  const { mutate } = verify;
  useOnce(() => {
    if (token !== null) mutate({ token });
  });

  return (
    <AuthLayout title={t('verify.title')} footer={<BackToLogin />}>
      {token === null && <Notice tone="info">{t('verify.missing')}</Notice>}
      {verify.isPending && <Notice tone="info">{t('verify.pending')}</Notice>}
      {verify.isSuccess && <Notice>{t('verify.done')}</Notice>}
      {verify.isError && <Notice tone="info">{t('verify.invalid')}</Notice>}
      {(token === null || verify.isError) && <ResendForm />}
    </AuthLayout>
  );
}
