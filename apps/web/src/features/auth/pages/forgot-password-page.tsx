import { zodResolver } from '@hookform/resolvers/zod';
import type { JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ForgotPasswordRequestSchema, type ForgotPasswordRequest } from '@orbit/contracts';

import { FormField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { authApi, useAuthMutation } from '../api/auth.api';
import { AuthLayout, BackToLogin, Notice } from '../components/auth-layout';

/** Mot de passe oublié : la réponse est la même que le compte existe ou non (SECURITY.md §3.5). */
export function ForgotPasswordPage(): JSX.Element {
  const { t } = useTranslation('auth');
  const forgot = useAuthMutation(authApi.forgotPassword);
  const form = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(ForgotPasswordRequestSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });
  const onSubmit = form.handleSubmit((values) => {
    forgot.mutate(values);
  });
  return (
    <AuthLayout title={t('forgot.title')} footer={<BackToLogin />}>
      {forgot.isSuccess ? (
        <Notice>{t('forgot.done')}</Notice>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
          <p className="text-small text-muted-foreground">{t('forgot.intro')}</p>
          <FormField label={t('fields.email')} error={form.formState.errors.email?.message}>
            <Input type="email" autoComplete="email" inputMode="email" {...form.register('email')} />
          </FormField>
          <FormError error={forgot.error} />
          <Button type="submit" disabled={forgot.isPending}>
            {t('forgot.submit')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
