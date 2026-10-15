import { zodResolver } from '@hookform/resolvers/zod';
import type { JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { LoginRequestSchema, type LoginRequest } from '@orbit/contracts';

import { FormField } from '@/components/forms/form-field';
import { FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { displayCodeOf } from '@/lib/http/api-error-message';

import { useLogin } from '../api/auth.api';
import { AuthLayout, Notice } from '../components/auth-layout';
import { ResendVerification } from '../components/resend-verification';

export type LoginNotice = 'expired' | 'passwordReset';

function isLoginNotice(value: unknown): value is LoginNotice {
  return value === 'expired' || value === 'passwordReset';
}

const LINK_CLASS = 'text-primary underline underline-offset-4';

function LoginFooter(): JSX.Element {
  const { t } = useTranslation('auth');
  return (
    <>
      <Link to="/forgot-password" className={LINK_CLASS}>
        {t('login.forgot')}
      </Link>
      <p>
        {t('login.noAccount')}{' '}
        <Link to="/register" className={LINK_CLASS}>
          {t('login.register')}
        </Link>
      </p>
    </>
  );
}

type LoginPageProps = Readonly<{ resolveNext: (next: string | null) => string }>;

/** Connexion (PHASE-02 §6) : message générique, compte non vérifié avec renvoi, 429 avec délai. */
export function LoginPage({ resolveNext }: LoginPageProps): JSX.Element {
  const { t } = useTranslation('auth');
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const login = useLogin();
  const form = useForm<LoginRequest>({
    resolver: zodResolver(LoginRequestSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });
  const notice: unknown = (location.state as { notice?: unknown } | null)?.notice;
  const unverified = login.isError && displayCodeOf(login.error) === 'EMAIL_NOT_VERIFIED';
  const onSubmit = form.handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => void navigate(resolveNext(params.get('next')), { replace: true }),
    });
  });

  return (
    <AuthLayout title={t('login.title')} footer={<LoginFooter />}>
      {isLoginNotice(notice) && <Notice tone="info">{t(`login.${notice}`)}</Notice>}
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <FormField label={t('fields.email')} error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register('email')} />
        </FormField>
        <FormField label={t('fields.password')} error={form.formState.errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...form.register('password')} />
        </FormField>
        {unverified ? (
          <Notice tone="info">{t('login.unverified')}</Notice>
        ) : (
          <FormError error={login.error} />
        )}
        <Button type="submit" disabled={login.isPending}>
          {t('login.submit')}
        </Button>
      </form>
      {unverified && <ResendVerification email={form.getValues('email')} />}
    </AuthLayout>
  );
}
