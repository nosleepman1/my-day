import { zodResolver } from '@hookform/resolvers/zod';
import type { JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { z } from 'zod';

import { EmailSchema } from '@orbit/contracts';

import { FormField } from '@/components/forms/form-field';
import { applyApiFieldErrors, FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { authApi, useAuthMutation } from '../api/auth.api';
import { AuthLayout, Notice } from '../components/auth-layout';

/** Formulaire : `displayName` vide = absent (le contrat le refuse s'il est vide). */
const RegisterFormSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(1_024),
  displayName: z.string().trim().max(80),
});
type RegisterForm = z.infer<typeof RegisterFormSchema>;

function RegisterFooter(): JSX.Element {
  const { t } = useTranslation('auth');
  return (
    <p>
      {t('register.hasAccount')}{' '}
      <Link to="/login" className="text-primary underline underline-offset-4">
        {t('register.login')}
      </Link>
    </p>
  );
}

/** Inscription (PHASE-02 §6) : la confirmation est générique, que l'adresse existe ou non. */
export function RegisterPage(): JSX.Element {
  const { t } = useTranslation('auth');
  const register = useAuthMutation(authApi.register);
  const form = useForm<RegisterForm>({
    resolver: zodResolver(RegisterFormSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '', displayName: '' },
  });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit(({ displayName, ...values }) => {
    register.mutate(displayName === '' ? values : { ...values, displayName }, {
      onError: (error) => applyApiFieldErrors(error, form.setError, ['email', 'password', 'displayName']),
    });
  });

  return (
    <AuthLayout title={t('register.title')} footer={<RegisterFooter />}>
      {register.isSuccess ? (
        <Notice>{t('register.done')}</Notice>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
          <FormField label={t('fields.displayName')} error={errors.displayName?.message}>
            <Input autoComplete="given-name" {...form.register('displayName')} />
          </FormField>
          <FormField label={t('fields.email')} error={errors.email?.message}>
            <Input type="email" autoComplete="email" inputMode="email" {...form.register('email')} />
          </FormField>
          <FormField label={t('fields.password')} hint={t('hints.password')} error={errors.password?.message}>
            <Input type="password" autoComplete="new-password" {...form.register('password')} />
          </FormField>
          <FormError error={errors.password === undefined ? register.error : null} />
          <Button type="submit" disabled={register.isPending}>
            {t('register.submit')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
