import { useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { AccountAdjustmentInput, AccountResponse, EntryDirection } from '@orbit/contracts';

import { MoneyInput } from '@/components/forms/money-input';
import { moneyInputToMinor } from '@/components/forms/money-input-value';
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
import { uuidv7 } from '@/lib/ids';

import { financeApi } from '../api/finance.api';
import { useFinanceMutation } from '../api/hooks';

import { NativeSelect } from './common';

type AdjustDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountResponse;
}>;

interface AdjustFormState {
  amount: string;
  direction: EntryDirection;
  reason: string;
}

function AdjustFormFields({
  state,
  account,
  onChange,
}: Readonly<{
  state: AdjustFormState;
  account: AccountResponse;
  onChange: (patch: Partial<AdjustFormState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <>
      <div className="flex flex-col gap-1">
        <Label htmlFor="adjust-amount">{t('adjustments.amount')}</Label>
        <MoneyInput
          id="adjust-amount"
          value={state.amount}
          onValueChange={(val) => {
            onChange({ amount: val });
          }}
          currency={account.currency}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="adjust-direction">{t('adjustments.direction')}</Label>
        <NativeSelect
          id="adjust-direction"
          value={state.direction}
          onChange={(e) => {
            onChange({ direction: e.target.value as EntryDirection });
          }}
          options={[
            { value: 'CREDIT', label: t('adjustments.credit') },
            { value: 'DEBIT', label: t('adjustments.debit') },
          ]}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="adjust-reason">{t('adjustments.reason')}</Label>
        <Input
          id="adjust-reason"
          required
          placeholder={t('adjustments.reasonPlaceholder')}
          value={state.reason}
          onChange={(e) => {
            onChange({ reason: e.target.value });
          }}
        />
      </div>
    </>
  );
}

function useAdjustSubmit(
  account: AccountResponse,
  form: AdjustFormState,
  setForm: (fn: (c: AdjustFormState) => AdjustFormState) => void,
  onOpenChange: (open: boolean) => void,
) {
  const { t } = useTranslation('finance');
  const mutation = useFinanceMutation(
    (input: AccountAdjustmentInput) => financeApi.adjustAccount(account.id, input, uuidv7()),
    { successMessage: t('adjustments.success') },
  );

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (form.amount.trim() === '' || form.amount === '0' || form.reason.trim() === '') return;
    const payload: AccountAdjustmentInput = {
      amountMinor: moneyInputToMinor(form.amount, account.currency),
      direction: form.direction,
      valueDate: new Date().toISOString().slice(0, 10),
      reason: form.reason.trim(),
    };
    void mutation.mutateAsync(payload).then(() => {
      onOpenChange(false);
      setForm(() => ({ amount: '0', direction: 'CREDIT', reason: '' }));
    });
  };

  return { mutation, handleSubmit };
}

export function AdjustBalanceDialog({ open, onOpenChange, account }: AdjustDialogProps): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  const [form, setForm] = useState<AdjustFormState>({
    amount: '0',
    direction: 'CREDIT',
    reason: '',
  });

  const { mutation, handleSubmit } = useAdjustSubmit(account, form, setForm, onOpenChange);
  const isInvalid = form.amount.trim() === '' || form.amount === '0' || form.reason.trim() === '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common:actions.close')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('adjustments.title')}</DialogTitle>
            <DialogDescription>{account.name}</DialogDescription>
          </DialogHeader>
          <AdjustFormFields
            state={form}
            account={account}
            onChange={(p) => {
              setForm((c) => ({ ...c, ...p }));
            }}
          />
          <DialogFooter>
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending || isInvalid}>
              {mutation.isPending ? t('adjustments.submitting') : t('adjustments.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
