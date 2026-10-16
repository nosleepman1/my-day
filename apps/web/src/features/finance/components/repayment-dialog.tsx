import { useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { AccountResponse, CreateRepaymentInput, DebtResponse } from '@orbit/contracts';
import { isCurrencyCode, type CurrencyCode } from '@orbit/money';

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
import { useOnlineStatus } from '@/hooks/use-online-status';
import { uuidv7 } from '@/lib/ids';

import { financeApi } from '../api/finance.api';
import { useFinanceAccounts, useFinanceMutation } from '../api/hooks';

import { NativeSelect } from './common';

type RepaymentDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt: DebtResponse;
}>;

interface FormState {
  mode: 'new' | 'attach';
  accountId: string;
  transactionId: string;
  amount: string;
  date: string;
  notes: string;
}

function initialFormState(): FormState {
  return {
    mode: 'new',
    accountId: '',
    transactionId: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  };
}

function RepaymentHeader(): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <DialogHeader>
      <DialogTitle>{t('repaymentDialog.title')}</DialogTitle>
      <DialogDescription>{t('repaymentDialog.description')}</DialogDescription>
    </DialogHeader>
  );
}

function RepaymentModeField({
  mode,
  onChange,
}: Readonly<{ mode: 'new' | 'attach'; onChange: (mode: 'new' | 'attach') => void }>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="repay-mode">{t('repaymentDialog.mode')}</Label>
      <NativeSelect
        id="repay-mode"
        value={mode}
        onChange={(e) => {
          onChange(e.target.value as 'new' | 'attach');
        }}
        options={[
          { value: 'new', label: t('repaymentDialog.modeNew') },
          { value: 'attach', label: t('repaymentDialog.modeAttach') },
        ]}
      />
    </div>
  );
}

function RepaymentNewMovementFields({
  accountId,
  onAccountChange,
  date,
  onDateChange,
  eligibleAccounts,
}: Readonly<{
  accountId: string;
  onAccountChange: (val: string) => void;
  date: string;
  onDateChange: (val: string) => void;
  eligibleAccounts: AccountResponse[];
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="repay-account">{t('repaymentDialog.account')}</Label>
        <NativeSelect
          id="repay-account"
          required
          value={accountId}
          onChange={(e) => {
            onAccountChange(e.target.value);
          }}
          options={[
            { value: '', label: t('transactions.allAccounts') },
            ...eligibleAccounts.map((a) => ({
              value: a.id,
              label: `${a.name} (${a.currency})`,
            })),
          ]}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="repay-date">{t('repaymentDialog.date')}</Label>
        <Input
          id="repay-date"
          type="date"
          required
          value={date}
          onChange={(e) => {
            onDateChange(e.target.value);
          }}
        />
      </div>
    </div>
  );
}

function RepaymentAttachTransactionField({
  transactionId,
  onChange,
}: Readonly<{ transactionId: string; onChange: (val: string) => void }>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="repay-tx-id">{t('repaymentDialog.transactionId')}</Label>
      <Input
        id="repay-tx-id"
        required
        placeholder={t('repaymentDialog.transactionIdPlaceholder')}
        value={transactionId}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </div>
  );
}

function RepaymentMovementFields({
  form,
  onChange,
  eligibleAccounts,
}: Readonly<{
  form: FormState;
  onChange: (updater: (prev: FormState) => FormState) => void;
  eligibleAccounts: AccountResponse[];
}>): JSX.Element {
  if (form.mode === 'new') {
    return (
      <RepaymentNewMovementFields
        accountId={form.accountId}
        onAccountChange={(accountId) => {
          onChange((prev) => ({ ...prev, accountId }));
        }}
        date={form.date}
        onDateChange={(date) => {
          onChange((prev) => ({ ...prev, date }));
        }}
        eligibleAccounts={eligibleAccounts}
      />
    );
  }

  return (
    <RepaymentAttachTransactionField
      transactionId={form.transactionId}
      onChange={(transactionId) => {
        onChange((prev) => ({ ...prev, transactionId }));
      }}
    />
  );
}

function RepaymentAmountNotesFields({
  form,
  onChange,
  currency,
}: Readonly<{
  form: FormState;
  onChange: (updater: (prev: FormState) => FormState) => void;
  currency: CurrencyCode;
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <>
      <div className="flex flex-col gap-1">
        <Label htmlFor="repay-amount">{t('repaymentDialog.amount')}</Label>
        <MoneyInput
          id="repay-amount"
          value={form.amount}
          onValueChange={(amount) => {
            onChange((prev) => ({ ...prev, amount }));
          }}
          currency={currency}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="repay-notes">{t('repaymentDialog.notes')}</Label>
        <Input
          id="repay-notes"
          placeholder={t('repaymentDialog.notesPlaceholder')}
          value={form.notes}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, notes: e.target.value }));
          }}
        />
      </div>
    </>
  );
}

function RepaymentFooter({
  onClose,
  disabled,
  isPending,
}: Readonly<{
  onClose: () => void;
  disabled: boolean;
  isPending: boolean;
}>): JSX.Element {
  const { t } = useTranslation('common');

  return (
    <DialogFooter>
      <Button type="button" variant="secondary" onClick={onClose}>
        {t('actions.cancel')}
      </Button>
      <Button type="submit" disabled={disabled}>
        {isPending ? t('states.loading') : t('actions.confirm')}
      </Button>
    </DialogFooter>
  );
}

function isRepaymentInvalid(form: FormState, online: boolean): boolean {
  if (!online || form.amount.trim() === '' || form.amount === '0') return true;
  if (form.mode === 'new' && !form.accountId) return true;
  if (form.mode === 'attach' && !form.transactionId.trim()) return true;
  return false;
}

function buildRepaymentPayload(form: FormState, currency: CurrencyCode): CreateRepaymentInput {
  const amountMinor = moneyInputToMinor(form.amount, currency);
  return {
    amountMinor,
    notes: form.notes.trim() ? form.notes.trim() : undefined,
    ...(form.mode === 'new'
      ? { accountId: form.accountId, date: form.date }
      : { transactionId: form.transactionId }),
  };
}

export function RepaymentDialog({ open, onOpenChange, debt }: RepaymentDialogProps): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  const online = useOnlineStatus();
  const [form, setForm] = useState<FormState>(initialFormState);
  const currency: CurrencyCode = isCurrencyCode(debt.currency) ? debt.currency : 'XOF';

  const accounts = useFinanceAccounts({ archived: false }).data?.data ?? [];
  const matchingAccounts = accounts.filter((a) => a.currency === debt.currency);
  const eligibleAccounts = matchingAccounts.length > 0 ? matchingAccounts : accounts;

  const mutation = useFinanceMutation(
    (input: CreateRepaymentInput) => financeApi.createDebtRepayment(debt.id, input, uuidv7()),
    { successMessage: t('repaymentDialog.createdSuccess') },
  );

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (isRepaymentInvalid(form, online)) return;

    const payload = buildRepaymentPayload(form, currency);
    void mutation.mutateAsync(payload).then(() => {
      onOpenChange(false);
      setForm(initialFormState());
    });
  };

  const isInvalid = isRepaymentInvalid(form, online);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common:actions.close')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <RepaymentHeader />
          <RepaymentModeField
            mode={form.mode}
            onChange={(mode) => {
              setForm((prev) => ({ ...prev, mode }));
            }}
          />
          <RepaymentMovementFields form={form} onChange={setForm} eligibleAccounts={eligibleAccounts} />
          <RepaymentAmountNotesFields form={form} onChange={setForm} currency={currency} />
          <RepaymentFooter
            onClose={() => {
              onOpenChange(false);
            }}
            disabled={isInvalid || mutation.isPending}
            isPending={mutation.isPending}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
