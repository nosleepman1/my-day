import { ArrowLeft } from 'lucide-react';
import { useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import type { AccountResponse, CreateTransferInput } from '@orbit/contracts';
import { isCurrencyCode, type CurrencyCode } from '@orbit/money';

import { MoneyInput } from '@/components/forms/money-input';
import { moneyInputToMinor } from '@/components/forms/money-input-value';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { uuidv7 } from '@/lib/ids';

import { financeApi } from '../api/finance.api';
import { useFinanceAccounts, useFinanceMutation } from '../api/hooks';
import { NativeSelect } from '../components/common';

interface TransferFormState {
  fromAccountId: string;
  toAccountId: string;
  fromAmount: string;
  toAmount: string;
  exchangeRate: string;
  feeAmount: string;
  valueDate: string;
  description: string;
  notes: string;
}

function initialTransferState(): TransferFormState {
  return {
    fromAccountId: '',
    toAccountId: '',
    fromAmount: '0',
    toAmount: '0',
    exchangeRate: '',
    feeAmount: '',
    valueDate: new Date().toISOString().slice(0, 10),
    description: '',
    notes: '',
  };
}

function TransferAccountsSection({
  state,
  accounts,
  onChange,
}: Readonly<{
  state: TransferFormState;
  accounts: readonly AccountResponse[];
  onChange: (patch: Partial<TransferFormState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  const accountOptions = [
    { value: '', label: t('transactions.allAccounts') },
    ...accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` })),
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="transfer-from">{t('transfer.fromAccount')}</Label>
        <NativeSelect
          id="transfer-from"
          required
          value={state.fromAccountId}
          onChange={(e) => {
            onChange({ fromAccountId: e.target.value });
          }}
          options={accountOptions}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="transfer-to">{t('transfer.toAccount')}</Label>
        <NativeSelect
          id="transfer-to"
          required
          value={state.toAccountId}
          onChange={(e) => {
            onChange({ toAccountId: e.target.value });
          }}
          options={accountOptions}
        />
      </div>
    </div>
  );
}

function MultiCurrencyFields({
  toCurrency,
  toAmount,
  exchangeRate,
  onChange,
}: Readonly<{
  toCurrency: CurrencyCode;
  toAmount: string;
  exchangeRate: string;
  onChange: (patch: Partial<TransferFormState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="transfer-to-amount">{t('transfer.convertedAmount')}</Label>
        <MoneyInput
          id="transfer-to-amount"
          value={toAmount}
          onValueChange={(val) => {
            onChange({ toAmount: val });
          }}
          currency={toCurrency}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="transfer-rate">{t('transfer.exchangeRate')}</Label>
        <Input
          id="transfer-rate"
          placeholder={t('transfer.ratePlaceholder')}
          value={exchangeRate}
          onChange={(e) => {
            onChange({ exchangeRate: e.target.value });
          }}
        />
      </div>
    </div>
  );
}

function TransferAmountsSection({
  state,
  fromCurrency,
  toCurrency,
  onChange,
}: Readonly<{
  state: TransferFormState;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  onChange: (patch: Partial<TransferFormState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  const isMultiCurrency = fromCurrency !== toCurrency;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="transfer-amount">{t('transfer.amount')}</Label>
          <MoneyInput
            id="transfer-amount"
            value={state.fromAmount}
            onValueChange={(val) => {
              onChange({ fromAmount: val });
            }}
            currency={fromCurrency}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="transfer-fee">{t('transfer.fee')}</Label>
          <MoneyInput
            id="transfer-fee"
            value={state.feeAmount}
            onValueChange={(val) => {
              onChange({ feeAmount: val });
            }}
            currency={fromCurrency}
          />
        </div>
      </div>
      {isMultiCurrency && (
        <MultiCurrencyFields
          toCurrency={toCurrency}
          toAmount={state.toAmount}
          exchangeRate={state.exchangeRate}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function TransferMetaSection({
  state,
  onChange,
}: Readonly<{
  state: TransferFormState;
  onChange: (patch: Partial<TransferFormState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="transfer-date">{t('transfer.date')}</Label>
          <Input
            id="transfer-date"
            type="date"
            required
            value={state.valueDate}
            onChange={(e) => {
              onChange({ valueDate: e.target.value });
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="transfer-desc">{t('transfer.description')}</Label>
          <Input
            id="transfer-desc"
            placeholder={t('transfer.descriptionPlaceholder')}
            value={state.description}
            onChange={(e) => {
              onChange({ description: e.target.value });
            }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="transfer-notes">{t('transfer.notes')}</Label>
        <Input
          id="transfer-notes"
          value={state.notes}
          onChange={(e) => {
            onChange({ notes: e.target.value });
          }}
        />
      </div>
    </>
  );
}

function buildTransferPayload(
  state: TransferFormState,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
): CreateTransferInput {
  const isMultiCurrency = fromCurrency !== toCurrency;
  const toMinor =
    isMultiCurrency && state.toAmount.trim() !== '' && state.toAmount !== '0'
      ? moneyInputToMinor(state.toAmount, toCurrency)
      : undefined;
  const feeMinor =
    state.feeAmount.trim() !== '' && state.feeAmount !== '0'
      ? moneyInputToMinor(state.feeAmount, fromCurrency)
      : undefined;

  return {
    fromAccountId: state.fromAccountId,
    toAccountId: state.toAccountId,
    fromAmountMinor: moneyInputToMinor(state.fromAmount, fromCurrency),
    toAmountMinor: toMinor,
    exchangeRate: state.exchangeRate.trim() || undefined,
    rateDate: state.exchangeRate.trim() !== '' ? state.valueDate : undefined,
    feeMinor,
    occurredAt: new Date().toISOString(),
    valueDate: state.valueDate,
    description: state.description.trim() || undefined,
    notes: state.notes.trim() || undefined,
  };
}

function safeCurrency(code?: string): CurrencyCode {
  return code !== undefined && isCurrencyCode(code) ? code : 'XOF';
}

function validateTransfer(
  form: TransferFormState,
  online: boolean,
): { sameAccount: boolean; isValid: boolean } {
  const hasAccounts = form.fromAccountId !== '' && form.toAccountId !== '';
  const sameAccount = hasAccounts && form.fromAccountId === form.toAccountId;
  const hasAmount = form.fromAmount.trim() !== '' && form.fromAmount !== '0';
  const isValid = online && hasAccounts && !sameAccount && hasAmount;
  return { sameAccount, isValid };
}

function TransferFormHeader(): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <header className="flex flex-col gap-2">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/finance/transactions">
          <ArrowLeft aria-hidden="true" className="mr-1 size-4" />
          {t('transactions.backToList')}
        </Link>
      </Button>
      <h1 className="text-h1">{t('transfer.title')}</h1>
    </header>
  );
}

interface TransferSubmitOptions {
  form: TransferFormState;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  isValid: boolean;
  idempotencyKey: string;
}

function useTransferSubmit({
  form,
  fromCurrency,
  toCurrency,
  isValid,
  idempotencyKey,
}: TransferSubmitOptions) {
  const { t } = useTranslation('finance');
  const navigate = useNavigate();
  const mutation = useFinanceMutation(
    (input: CreateTransferInput) => financeApi.createTransfer(input, idempotencyKey),
    { successMessage: t('transfer.success') },
  );

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (!isValid) return;
    const payload = buildTransferPayload(form, fromCurrency, toCurrency);
    void mutation.mutateAsync(payload).then(() => {
      void navigate('/finance/transactions');
    });
  };

  return { mutation, handleSubmit };
}

function TransferFormSections({
  state,
  accounts,
  fromCurrency,
  toCurrency,
  onChange,
}: Readonly<{
  state: TransferFormState;
  accounts: readonly AccountResponse[];
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  onChange: (patch: Partial<TransferFormState>) => void;
}>): JSX.Element {
  return (
    <>
      <TransferAccountsSection state={state} accounts={accounts} onChange={onChange} />
      <TransferAmountsSection
        state={state}
        fromCurrency={fromCurrency}
        toCurrency={toCurrency}
        onChange={onChange}
      />
      <TransferMetaSection state={state} onChange={onChange} />
    </>
  );
}

export function TransferFormPage(): JSX.Element {
  const { t } = useTranslation('finance');
  const online = useOnlineStatus();
  const [idempotencyKey] = useState(uuidv7);
  const [form, setForm] = useState<TransferFormState>(initialTransferState);

  const accounts = useFinanceAccounts({ archived: false }).data?.data ?? [];
  const fromCurrency = safeCurrency(accounts.find((a) => a.id === form.fromAccountId)?.currency);
  const toCurrency = safeCurrency(accounts.find((a) => a.id === form.toAccountId)?.currency);
  const { sameAccount, isValid } = validateTransfer(form, online);
  const { mutation, handleSubmit } = useTransferSubmit({
    form,
    fromCurrency,
    toCurrency,
    isValid,
    idempotencyKey,
  });

  return (
    <main className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl">
      <TransferFormHeader />
      {!online && (
        <Card className="border-warning bg-warning-surface p-3 text-warning">{t('offlineWarning')}</Card>
      )}
      {sameAccount && (
        <Card className="border-danger bg-danger-surface p-3 text-danger">
          {t('transfer.sameAccountError')}
        </Card>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TransferFormSections
          state={form}
          accounts={accounts}
          fromCurrency={fromCurrency}
          toCurrency={toCurrency}
          onChange={(p) => {
            setForm((c) => ({ ...c, ...p }));
          }}
        />
        <Button type="submit" disabled={mutation.isPending || !isValid} className="mt-2">
          {mutation.isPending ? t('transfer.submitting') : t('transfer.submit')}
        </Button>
      </form>
    </main>
  );
}
