import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { JSX } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';

import { FormField } from '@/components/forms/form-field';
import { applyApiFieldErrors, FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { sessionKeys } from '@/lib/query-keys';

import { meApi } from '../api/me.api';

type PasswordForm = Readonly<{ currentPassword: string; newPassword: string; confirmPassword: string }>;

function passwordSchema(mismatch: string): z.ZodType<PasswordForm, PasswordForm> {
  return z
    .object({
      currentPassword: z.string().min(1).max(1_024),
      newPassword: z.string().min(1).max(1_024),
      confirmPassword: z.string(),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      path: ['confirmPassword'],
      message: mismatch,
    });
}

function PasswordFields({ form }: Readonly<{ form: UseFormReturn<PasswordForm> }>): JSX.Element {
  const { t } = useTranslation(['settings', 'auth']);
  const { errors } = form.formState;
  return (
    <>
      <FormField label={t('security.password.current')} error={errors.currentPassword?.message}>
        <Input type="password" autoComplete="current-password" {...form.register('currentPassword')} />
      </FormField>
      <FormField
        label={t('auth:fields.newPassword')}
        hint={t('auth:hints.password')}
        error={errors.newPassword?.message}
      >
        <Input type="password" autoComplete="new-password" {...form.register('newPassword')} />
      </FormField>
      <FormField label={t('auth:fields.confirmPassword')} error={errors.confirmPassword?.message}>
        <Input type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
      </FormField>
    </>
  );
}

/** `POST /me/password` : le mot de passe actuel vaut ré-authentification ; les autres sessions tombent. */
export function PasswordCard(): JSX.Element {
  const { t } = useTranslation(['settings', 'auth']);
  const queryClient = useQueryClient();
  const change = useMutation({
    mutationFn: meApi.changePassword,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.sessions() }),
  });
  const form = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema(t('auth:mismatch'))),
    mode: 'onTouched',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const onSubmit = form.handleSubmit(({ currentPassword, newPassword }) => {
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          form.reset();
          toast.success(t('security.password.done'));
        },
        onError: (error) => applyApiFieldErrors(error, form.setError, ['newPassword']),
      },
    );
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('security.password.title')}</CardTitle>
      </CardHeader>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <PasswordFields form={form} />
        <FormError error={form.formState.errors.newPassword === undefined ? change.error : null} />
        <Button type="submit" className="self-end" disabled={change.isPending}>
          {t('security.password.submit')}
        </Button>
      </form>
    </Card>
  );
}
