import { useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { AccountResponse, ConfirmReconciliation } from '@orbit/contracts';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { MoneyInput } from '@/components/forms/money-input';
import { moneyInputToMinor } from '@/components/forms/money-input-value';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { useFinanceMutation, useFinanceReconciliationPreview } from '../api/hooks';

type ReconcileDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountResponse;
}>;

interface ReconcileFormState {
  statementDate: string;
  statementBalance: string;
}

function ReconciliationPreviewCard({
  accountId,
  statementDate,
  statementBalance,
  currency,
}: Readonly<{
  accountId: string;
  statementDate: string;
  statementBalance: string;
  currency: string;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  const hasBalance = statementBalance.trim() !== '';
  const statementEndingBalanceMinor = hasBalance
    ? moneyInputToMinor(statementBalance, currency as never)
    : '0';
  const preview = useFinanceReconciliationPreview(
    accountId,
    { statementDate, statementEndingBalanceMinor },
    statementDate !== '' && hasBalance,
  ).data?.data;

  if (!preview) return <></>;

  const isMatch = preview.clearedBalanceMinor === statementEndingBalanceMinor;

  return (
    <Card className="flex flex-col gap-2 bg-surface-muted p-3">
      <div className="flex items-center justify-between text-caption">
        <span>{t('reconciliation.clearedBalance')}</span>
        <MoneyAmount minor={preview.clearedBalanceMinor} currency={currency} kind="balance" />
      </div>
      {isMatch ? (
        <p className="text-caption text-success font-medium">{t('reconciliation.noDiscrepancy')}</p>
      ) : (
        <div className="flex items-center justify-between text-caption text-warning">
          <span>{t('reconciliation.difference')}</span>
          <MoneyAmount minor={preview.differenceMinor} currency={currency} kind="out" />
        </div>
      )}
    </Card>
  );
}

function ReconcileFormInputs({
  state,
  currency,
  onChange,
}: Readonly<{
  state: ReconcileFormState;
  currency: string;
  onChange: (patch: Partial<ReconcileFormState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <>
      <div className="flex flex-col gap-1">
        <Label htmlFor="reconcile-date">{t('reconciliation.statementDate')}</Label>
        <Input
          id="reconcile-date"
          type="date"
          required
          value={state.statementDate}
          onChange={(e) => {
            onChange({ statementDate: e.target.value });
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="reconcile-balance">{t('reconciliation.statementBalance')}</Label>
        <MoneyInput
          id="reconcile-balance"
          value={state.statementBalance}
          onValueChange={(val) => {
            onChange({ statementBalance: val });
          }}
          currency={currency as never}
        />
      </div>
    </>
  );
}

function useReconcileSubmit(
  account: AccountResponse,
  form: ReconcileFormState,
  onOpenChange: (open: boolean) => void,
) {
  const { t } = useTranslation('finance');
  const mutation = useFinanceMutation(
    (input: ConfirmReconciliation) => financeApi.confirmReconciliation(account.id, input, uuidv7()),
    { successMessage: t('reconciliation.confirmSuccess') },
  );

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (form.statementDate === '' || form.statementBalance.trim() === '') return;
    const payload: ConfirmReconciliation = {
      statementDate: form.statementDate,
      statementEndingBalanceMinor: moneyInputToMinor(form.statementBalance, account.currency),
      createAdjustmentIfNeeded: false,
    };
    void mutation.mutateAsync(payload).then(() => {
      onOpenChange(false);
    });
  };

  return { mutation, handleSubmit };
}

export function ReconcileDialog({ open, onOpenChange, account }: ReconcileDialogProps): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  const [form, setForm] = useState<ReconcileFormState>({
    statementDate: new Date().toISOString().slice(0, 10),
    statementBalance: '0',
  });

  const { mutation, handleSubmit } = useReconcileSubmit(account, form, onOpenChange);
  const isInvalid = form.statementDate === '' || form.statementBalance.trim() === '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common:actions.close')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('reconciliation.title')}</DialogTitle>
            <DialogDescription>{account.name}</DialogDescription>
          </DialogHeader>
          <ReconcileFormInputs
            state={form}
            currency={account.currency}
            onChange={(p) => {
              setForm((c) => ({ ...c, ...p }));
            }}
          />
          <ReconciliationPreviewCard
            accountId={account.id}
            statementDate={form.statementDate}
            statementBalance={form.statementBalance}
            currency={account.currency}
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
              {mutation.isPending ? t('common:states.loading') : t('reconciliation.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
