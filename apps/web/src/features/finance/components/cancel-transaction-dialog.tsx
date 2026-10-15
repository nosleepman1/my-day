import { useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

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

import { financeApi } from '../api/finance.api';
import { useFinanceMutation } from '../api/hooks';

type CancelDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
}>;

function CancelReasonInput({
  value,
  onChange,
}: Readonly<{
  value: string;
  onChange: (val: string) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="cancel-reason">{t('transactions.cancelReason')}</Label>
      <Input
        id="cancel-reason"
        required
        minLength={3}
        placeholder={t('transactions.cancelReasonPlaceholder')}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </div>
  );
}

function CancelDialogFooter({
  pending,
  disabled,
  onCancel,
}: Readonly<{
  pending: boolean;
  disabled: boolean;
  onCancel: () => void;
}>): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  return (
    <DialogFooter>
      <Button variant="secondary" type="button" onClick={onCancel}>
        {t('common:actions.cancel')}
      </Button>
      <Button variant="destructive" type="submit" disabled={disabled}>
        {pending ? t('common:states.loading') : t('transactions.cancelConfirm')}
      </Button>
    </DialogFooter>
  );
}

export function CancelTransactionDialog({
  open,
  onOpenChange,
  transactionId,
}: CancelDialogProps): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  const [reason, setReason] = useState('');

  const cancelMutation = useFinanceMutation(
    (cancelReason: string) => financeApi.cancelTransaction(transactionId, { reason: cancelReason }),
    { successMessage: t('transactions.cancelSuccess') },
  );

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (reason.trim().length < 3) return;
    void cancelMutation.mutateAsync(reason.trim()).then(() => {
      onOpenChange(false);
      setReason('');
    });
  };

  const handleClose = (): void => {
    onOpenChange(false);
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common:actions.close')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('transactions.cancelTitle')}</DialogTitle>
            <DialogDescription>{t('transactions.cancelConfirmText')}</DialogDescription>
          </DialogHeader>
          <CancelReasonInput value={reason} onChange={setReason} />
          <CancelDialogFooter
            pending={cancelMutation.isPending}
            disabled={cancelMutation.isPending || reason.trim().length < 3}
            onCancel={handleClose}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
