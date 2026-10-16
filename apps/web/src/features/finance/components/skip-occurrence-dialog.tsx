import { useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { RecurringOccurrenceResponse } from '@orbit/contracts';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOnlineStatus } from '@/hooks/use-online-status';

import { financeApi } from '../api/finance.api';
import { useFinanceMutation } from '../api/hooks';

type SkipOccurrenceDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occurrence: RecurringOccurrenceResponse;
}>;

function SkipOccurrenceDialogFooter({
  onClose,
  disabled,
  loading,
}: Readonly<{ onClose: () => void; disabled: boolean; loading: boolean }>): JSX.Element {
  const { t } = useTranslation('common');

  return (
    <DialogFooter>
      <Button type="button" variant="secondary" onClick={onClose}>
        {t('actions.cancel')}
      </Button>
      <Button type="submit" variant="destructive" disabled={disabled || loading}>
        {loading ? t('states.loading') : t('actions.confirm')}
      </Button>
    </DialogFooter>
  );
}

function SkipOccurrenceHeader({
  occurrence,
}: Readonly<{ occurrence: RecurringOccurrenceResponse }>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <DialogHeader>
      <DialogTitle>{t('skipOccurrenceDialog.title')}</DialogTitle>
      <DialogDescription>
        {occurrence.recurringTransaction?.name ?? ''} —{' '}
        <MoneyAmount
          minor={occurrence.expectedAmountMinor}
          currency={occurrence.currency}
          className="font-semibold"
        />
      </DialogDescription>
    </DialogHeader>
  );
}

function SkipOccurrenceForm({
  occurrence,
  onClose,
}: Readonly<{
  occurrence: RecurringOccurrenceResponse;
  onClose: () => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  const online = useOnlineStatus();
  const [reason, setReason] = useState('');

  const mutation = useFinanceMutation(
    () => financeApi.skipOccurrence(occurrence.id, reason.trim() ? { reason: reason.trim() } : undefined),
    { successMessage: t('skipOccurrenceDialog.skippedSuccess') },
  );

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (!online) return;
    void mutation.mutateAsync().then(onClose);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <SkipOccurrenceHeader occurrence={occurrence} />

      <div className="flex flex-col gap-1">
        <Label htmlFor="skip-reason">{t('skipOccurrenceDialog.reason')}</Label>
        <Input
          id="skip-reason"
          maxLength={500}
          placeholder={t('skipOccurrenceDialog.reasonPlaceholder')}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
          }}
        />
      </div>

      <SkipOccurrenceDialogFooter onClose={onClose} disabled={!online} loading={mutation.isPending} />
    </form>
  );
}

export function SkipOccurrenceDialog({
  open,
  onOpenChange,
  occurrence,
}: SkipOccurrenceDialogProps): JSX.Element {
  const { t } = useTranslation('common');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('actions.close')}>
        <SkipOccurrenceForm
          occurrence={occurrence}
          onClose={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
