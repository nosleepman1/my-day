import { zodResolver } from '@hookform/resolvers/zod';
import type { JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';

import { FormField } from '@/components/forms/form-field';
import { applyApiFieldErrors, FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { displayCodeOf } from '@/lib/http/api-error-message';

import { authApi, useAuthMutation } from '../api/auth.api';
import { AuthLayout, BackToLogin, Notice, useFragmentToken } from '../components/auth-layout';

type ResetForm = Readonly<{ newPassword: string; confirmPassword: string }>;

function useResetForm(mismatch: string): ReturnType<typeof useForm<ResetForm>> {
  const schema = z
    .object({ newPassword: z.string().min(1).max(1_024), confirmPassword: z.string() })
    .refine((values) => values.newPassword === values.confirmPassword, {
      path: ['confirmPassword'],
      message: mismatch,
    });
  return useForm<ResetForm>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
}

/** Réinitialisation : jeton du lien, nouveau mot de passe confirmé, puis retour à la connexion. */
export function ResetPasswordPage(): JSX.Element {
  const { t } = useTranslation('auth');
  const token = useFragmentToken();
  const navigate = useNavigate();
  const reset = useAuthMutation(authApi.resetPassword);
  const form = useResetForm(t('mismatch'));
  const invalidLink = token === null || ['GONE', 'NOT_FOUND'].includes(displayCodeOf(reset.error));
  const onSubmit = form.handleSubmit(({ newPassword }) => {
    if (token === null) return;
    reset.mutate(
      { token, newPassword },
      {
        onSuccess: () => void navigate('/login', { replace: true, state: { notice: 'passwordReset' } }),
        onError: (error) => applyApiFieldErrors(error, form.setError, ['newPassword']),
      },
    );
  });

  if (invalidLink) {
    return (
      <AuthLayout title={t('reset.title')} footer={<BackToLogin />}>
        <Notice tone="info">{t('reset.invalid')}</Notice>
        <Link to="/forgot-password" className="text-small text-primary underline underline-offset-4">
          {t('login.forgot')}
        </Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title={t('reset.title')} footer={<BackToLogin />}>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <FormField
          label={t('fields.newPassword')}
          hint={t('hints.password')}
          error={form.formState.errors.newPassword?.message}
        >
          <Input type="password" autoComplete="new-password" {...form.register('newPassword')} />
        </FormField>
        <FormField label={t('fields.confirmPassword')} error={form.formState.errors.confirmPassword?.message}>
          <Input type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
        </FormField>
        <FormError
          error={reset.isError && form.formState.errors.newPassword === undefined ? reset.error : null}
        />
        <Button type="submit" disabled={reset.isPending}>
          {t('reset.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
