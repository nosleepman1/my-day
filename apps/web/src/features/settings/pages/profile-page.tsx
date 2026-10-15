import { zodResolver } from '@hookform/resolvers/zod';
import type { JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { UpdateProfileRequestSchema, type SessionUser, type UpdateProfileRequest } from '@orbit/contracts';

import { LoadingState, ErrorState } from '@/components/data-display/states';
import { FormField } from '@/components/forms/form-field';
import { applyApiFieldErrors, FormError } from '@/components/forms/validation-errors';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { useMe, useUpdateProfile } from '../api/me.api';

function ProfileForm({ user }: Readonly<{ user: SessionUser }>): JSX.Element {
  const { t } = useTranslation(['settings', 'common']);
  const update = useUpdateProfile();
  const form = useForm<UpdateProfileRequest>({
    resolver: zodResolver(UpdateProfileRequestSchema),
    mode: 'onTouched',
    defaultValues: { displayName: user.displayName },
  });
  const onSubmit = form.handleSubmit((values) => {
    update.mutate(values, {
      onSuccess: () => toast.success(t('saved')),
      onError: (error) => applyApiFieldErrors(error, form.setError, ['displayName']),
    });
  });
  return (
    <Card>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
        <FormField label={t('profile.displayName')} error={form.formState.errors.displayName?.message}>
          <Input autoComplete="name" {...form.register('displayName')} />
        </FormField>
        <FormField label={t('profile.email')}>
          <Input value={user.email} readOnly />
        </FormField>
        <FormError
          error={update.isError && form.formState.errors.displayName === undefined ? update.error : null}
        />
        <Button type="submit" className="self-end" disabled={update.isPending}>
          {t('common:actions.save')}
        </Button>
      </form>
    </Card>
  );
}

/** `/settings/profile` : nom affiché. */
export function ProfilePage(): JSX.Element {
  const me = useMe();
  if (me.isPending) return <LoadingState />;
  if (me.isError) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  return <ProfileForm user={me.data.data} />;
}
