import { useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { AccountResponse, ConfirmOccurrenceInput, RecurringOccurrenceResponse } from '@orbit/contracts';

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
import { uuidv7 } from '@/lib/ids';

import { financeApi } from '../api/finance.api';
import { useFinanceAccounts, useFinanceMutation } from '../api/hooks';

import { NativeSelect } from './common';

type ConfirmOccurrenceDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occurrence: RecurringOccurrenceResponse;
}>;

interface FormState {
  mode: 'new' | 'attach';
  accountId: string;
  transactionId: string;
  valueDate: string;
  notes: string;
}

function initialFormState(occurrence: RecurringOccurrenceResponse): FormState {
  return {
    mode: 'new',
    accountId: occurrence.recurringTransaction?.accountId ?? '',
    transactionId: '',
    valueDate: occurrence.dueOn,
    notes: '',
  };
}

function ConfirmModeField({
  mode,
  onChange,
}: Readonly<{ mode: 'new' | 'attach'; onChange: (val: 'new' | 'attach') => void }>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="confirm-mode">{t('confirmOccurrenceDialog.mode')}</Label>
      <NativeSelect
        id="confirm-mode"
        value={mode}
        onChange={(e) => {
          onChange(e.target.value as 'new' | 'attach');
        }}
        options={[
          { value: 'new', label: t('confirmOccurrenceDialog.modeNew') },
          { value: 'attach', label: t('confirmOccurrenceDialog.modeAttach') },
        ]}
      />
    </div>
  );
}

function ConfirmNewFields({
  form,
  onChange,
  accounts,
}: Readonly<{
  form: FormState;
  onChange: (updater: (prev: FormState) => FormState) => void;
  accounts: AccountResponse[];
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="confirm-account">{t('confirmOccurrenceDialog.account')}</Label>
        <NativeSelect
          id="confirm-account"
          required
          value={form.accountId}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, accountId: e.target.value }));
          }}
          options={[
            { value: '', label: t('transactions.allAccounts') },
            ...accounts.map((a) => ({
              value: a.id,
              label: `${a.name} (${a.currency})`,
            })),
          ]}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="confirm-value-date">{t('confirmOccurrenceDialog.valueDate')}</Label>
        <Input
          id="confirm-value-date"
          type="date"
          required
          value={form.valueDate}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, valueDate: e.target.value }));
          }}
        />
      </div>
    </div>
  );
}

function ConfirmAttachField({
  transactionId,
  onChange,
}: Readonly<{ transactionId: string; onChange: (val: string) => void }>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="confirm-tx-id">{t('confirmOccurrenceDialog.transactionId')}</Label>
      <Input
        id="confirm-tx-id"
        required
        placeholder={t('confirmOccurrenceDialog.transactionIdPlaceholder')}
        value={transactionId}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </div>
  );
}

function buildConfirmPayload(form: FormState): ConfirmOccurrenceInput {
  return {
    ...(form.mode === 'new'
      ? { accountId: form.accountId, valueDate: form.valueDate }
      : { transactionId: form.transactionId }),
    notes: form.notes.trim() ? form.notes.trim() : undefined,
  };
}

function selectEligibleAccounts(accounts: AccountResponse[], currency: string): AccountResponse[] {
  const matching = accounts.filter((a) => a.currency === currency);
  return matching.length > 0 ? matching : accounts;
}

function isConfirmDisabled(
  online: boolean,
  mode: 'new' | 'attach',
  accountId: string,
  txId: string,
): boolean {
  if (!online) return true;
  return mode === 'new' ? !accountId : !txId.trim();
}

function ConfirmOccurrenceForm({
  occurrence,
  onClose,
}: Readonly<{
  occurrence: RecurringOccurrenceResponse;
  onClose: () => void;
}>): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  const online = useOnlineStatus();
  const [form, setForm] = useState<FormState>(() => initialFormState(occurrence));

  const accounts = useFinanceAccounts({ archived: false }).data?.data ?? [];
  const eligibleAccounts = selectEligibleAccounts(accounts, occurrence.currency);

  const mutation = useFinanceMutation(
    (input: ConfirmOccurrenceInput) => financeApi.confirmOccurrence(occurrence.id, input, uuidv7()),
    { successMessage: t('confirmOccurrenceDialog.confirmedSuccess') },
  );

  const disabled = isConfirmDisabled(online, form.mode, form.accountId, form.transactionId);

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (disabled) return;
    void mutation.mutateAsync(buildConfirmPayload(form)).then(onClose);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t('confirmOccurrenceDialog.title')}</DialogTitle>
        <DialogDescription>
          {occurrence.recurringTransaction?.name ?? ''} —{' '}
          <MoneyAmount
            minor={occurrence.expectedAmountMinor}
            currency={occurrence.currency}
            className="font-semibold"
          />
        </DialogDescription>
      </DialogHeader>

      <ConfirmModeField
        mode={form.mode}
        onChange={(mode) => {
          setForm((prev) => ({ ...prev, mode }));
        }}
      />

      {form.mode === 'new' ? (
        <ConfirmNewFields form={form} onChange={setForm} accounts={eligibleAccounts} />
      ) : (
        <ConfirmAttachField
          transactionId={form.transactionId}
          onChange={(txId) => {
            setForm((prev) => ({ ...prev, transactionId: txId }));
          }}
        />
      )}

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common:actions.cancel')}
        </Button>
        <Button type="submit" disabled={disabled || mutation.isPending}>
          {mutation.isPending ? t('common:states.loading') : t('common:actions.confirm')}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ConfirmOccurrenceDialog({
  open,
  onOpenChange,
  occurrence,
}: ConfirmOccurrenceDialogProps): JSX.Element {
  const { t } = useTranslation('common');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('actions.close')}>
        <ConfirmOccurrenceForm
          occurrence={occurrence}
          onClose={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
