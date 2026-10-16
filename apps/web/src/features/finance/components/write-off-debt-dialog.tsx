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

type WriteOffDebtDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtId: string;
}>;

function WriteOffReasonField({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (val: string) => void }>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="write-off-debt-reason">{t('writeOffDebtDialog.reason')}</Label>
      <Input
        id="write-off-debt-reason"
        required
        minLength={3}
        maxLength={500}
        placeholder={t('writeOffDebtDialog.reasonPlaceholder')}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </div>
  );
}

function WriteOffDebtForm({
  debtId,
  onClose,
}: Readonly<{ debtId: string; onClose: () => void }>): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  const online = useOnlineStatus();
  const [reason, setReason] = useState('');

  const mutation = useFinanceMutation(
    (closingReason: string) => financeApi.writeOffDebt(debtId, { closingReason }, uuidv7()),
    { successMessage: t('writeOffDebtDialog.writtenOffSuccess') },
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
        <DialogTitle>{t('writeOffDebtDialog.title')}</DialogTitle>
        <DialogDescription>{t('writeOffDebtDialog.description')}</DialogDescription>
      </DialogHeader>

      <WriteOffReasonField value={reason} onChange={setReason} />

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

export function WriteOffDebtDialog({ open, onOpenChange, debtId }: WriteOffDebtDialogProps): JSX.Element {
  const { t } = useTranslation('common');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('actions.close')}>
        <WriteOffDebtForm
          debtId={debtId}
          onClose={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
