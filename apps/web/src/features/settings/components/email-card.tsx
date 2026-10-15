import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import type { JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ChangeEmailRequestSchema, type ChangeEmailRequest } from '@orbit/contracts';

import { FormField } from '@/components/forms/form-field';
import { applyApiFieldErrors, FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { meApi } from '../api/me.api';

import { ReauthCancelledError, useReauth } from './reauth-dialog';

/** Changement d'adresse : ré-authentification récente exigée, lien envoyé à la nouvelle adresse. */
export function EmailCard({ currentEmail }: Readonly<{ currentEmail: string }>): JSX.Element {
  const { t } = useTranslation('settings');
  const reauth = useReauth();
  const change = useMutation({
    mutationFn: (body: ChangeEmailRequest) => reauth.run(() => meApi.changeEmail(body)),
  });
  const form = useForm<ChangeEmailRequest>({
    resolver: zodResolver(ChangeEmailRequestSchema),
    mode: 'onTouched',
    defaultValues: { newEmail: '' },
  });
  const onSubmit = form.handleSubmit((values) => {
    change.mutate(values, { onError: (error) => applyApiFieldErrors(error, form.setError, ['newEmail']) });
  });
  const visibleError = change.error instanceof ReauthCancelledError ? null : change.error;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('security.email.title')}</CardTitle>
        <p className="text-small text-muted-foreground">
          {t('security.email.current', { email: currentEmail })}
        </p>
      </CardHeader>
      {change.isSuccess ? (
        <p role="status" className="text-small text-success">
          {t('security.email.done')}
        </p>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
          <FormField label={t('security.email.newEmail')} error={form.formState.errors.newEmail?.message}>
            <Input type="email" autoComplete="email" {...form.register('newEmail')} />
          </FormField>
          <FormError error={form.formState.errors.newEmail === undefined ? visibleError : null} />
          <Button type="submit" className="self-end" disabled={change.isPending}>
            {t('security.email.submit')}
          </Button>
        </form>
      )}
      {reauth.dialog}
    </Card>
  );
}
