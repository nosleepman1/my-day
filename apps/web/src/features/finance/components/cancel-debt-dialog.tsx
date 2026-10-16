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
import { useOnlineStatus } from '@/hooks/use-online-status';
import { uuidv7 } from '@/lib/ids';

import { financeApi } from '../api/finance.api';
import { useFinanceMutation } from '../api/hooks';

type CancelDebtDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtId: string;
}>;

function CancelReasonField({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (val: string) => void }>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="cancel-debt-reason">{t('cancelDebtDialog.reason')}</Label>
      <Input
        id="cancel-debt-reason"
        required
        minLength={3}
        maxLength={500}
        placeholder={t('cancelDebtDialog.reasonPlaceholder')}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </div>
  );
}

function CancelDebtForm({ debtId, onClose }: Readonly<{ debtId: string; onClose: () => void }>): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  const online = useOnlineStatus();
  const [reason, setReason] = useState('');

  const mutation = useFinanceMutation(
    (closingReason: string) => financeApi.cancelDebt(debtId, { closingReason }, uuidv7()),
    { successMessage: t('cancelDebtDialog.cancelledSuccess') },
  );

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (!online || reason.trim().length < 3) return;

    void mutation.mutateAsync(reason.trim()).then(() => {
      onClose();
      setReason('');
    });
  };

  const isInvalid = !online || reason.trim().length < 3;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t('cancelDebtDialog.title')}</DialogTitle>
        <DialogDescription>{t('cancelDebtDialog.description')}</DialogDescription>
      </DialogHeader>

      <CancelReasonField value={reason} onChange={setReason} />

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common:actions.cancel')}
        </Button>
        <Button type="submit" variant="destructive" disabled={isInvalid || mutation.isPending}>
          {mutation.isPending ? t('common:states.loading') : t('common:actions.confirm')}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CancelDebtDialog({ open, onOpenChange, debtId }: CancelDebtDialogProps): JSX.Element {
  const { t } = useTranslation('common');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('actions.close')}>
        <CancelDebtForm
          debtId={debtId}
          onClose={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
