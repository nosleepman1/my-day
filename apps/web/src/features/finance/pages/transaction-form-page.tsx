import { ArrowLeft } from 'lucide-react';
import { useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';

import type { CreateTransactionInput } from '@orbit/contracts';
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
import {
  useFinanceAccounts,
  useFinanceCategories,
  useFinanceCounterparties,
  useFinanceMutation,
} from '../api/hooks';
import { NativeSelect } from '../components/common';

interface FormState {
  type: 'INCOME' | 'EXPENSE';
  accountId: string;
  amount: string;
  valueDate: string;
  categoryId: string;
  counterpartyId: string;
  description: string;
  notes: string;
}

function AccountAndAmountFields({
  state,
  currency,
  onChange,
}: Readonly<{
  state: FormState;
  currency: CurrencyCode;
  onChange: (patch: Partial<FormState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  const accounts = useFinanceAccounts({ archived: false }).data?.data ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="tx-account">{t('transactionForm.account')}</Label>
        <NativeSelect
          id="tx-account"
          required
          value={state.accountId}
          onChange={(e) => {
            onChange({ accountId: e.target.value });
          }}
          options={[
            { value: '', label: t('transactions.allAccounts') },
            ...accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` })),
          ]}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="tx-amount">{t('transactionForm.amount')}</Label>
        <MoneyInput
          id="tx-amount"
          value={state.amount}
          onValueChange={(val) => {
            onChange({ amount: val });
          }}
          currency={currency}
        />
      </div>
    </div>
  );
}

function ClassificationFields({
  state,
  onChange,
}: Readonly<{
  state: FormState;
  onChange: (patch: Partial<FormState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  const allCategories = useFinanceCategories().data?.data ?? [];
  const categories = allCategories.filter((c) => c.kind === state.type);
  const counterparties = useFinanceCounterparties().data?.data ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="tx-category">{t('transactionForm.category')}</Label>
        <NativeSelect
          id="tx-category"
          value={state.categoryId}
          onChange={(e) => {
            onChange({ categoryId: e.target.value });
          }}
          options={[
            { value: '', label: t('transactionForm.noCategory') },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="tx-counterparty">{t('transactionForm.counterparty')}</Label>
        <NativeSelect
          id="tx-counterparty"
          value={state.counterpartyId}
          onChange={(e) => {
            onChange({ counterpartyId: e.target.value });
          }}
          options={[
            { value: '', label: t('transactionForm.noCounterparty') },
            ...counterparties.map((cp) => ({ value: cp.id, label: cp.name })),
          ]}
        />
      </div>
    </div>
  );
}

function DetailsFields({
  state,
  onChange,
}: Readonly<{
  state: FormState;
  onChange: (patch: Partial<FormState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="tx-date">{t('transactionForm.date')}</Label>
          <Input
            id="tx-date"
            type="date"
            required
            value={state.valueDate}
            onChange={(e) => {
              onChange({ valueDate: e.target.value });
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="tx-description">{t('transactionForm.description')}</Label>
          <Input
            id="tx-description"
            placeholder={t('transactionForm.descriptionPlaceholder')}
            value={state.description}
            onChange={(e) => {
              onChange({ description: e.target.value });
            }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="tx-notes">{t('transactionForm.notes')}</Label>
        <Input
          id="tx-notes"
          placeholder={t('transactionForm.notesPlaceholder')}
          value={state.notes}
          onChange={(e) => {
            onChange({ notes: e.target.value });
          }}
        />
      </div>
    </>
  );
}

function buildTransactionPayload(state: FormState, currency: CurrencyCode): CreateTransactionInput {
  return {
    type: state.type,
    accountId: state.accountId,
    amountMinor: moneyInputToMinor(state.amount, currency),
    currency,
    valueDate: state.valueDate,
    occurredAt: new Date().toISOString(),
    categoryId: state.categoryId || undefined,
    counterpartyId: state.counterpartyId || undefined,
    description: state.description.trim() || undefined,
    notes: state.notes.trim() || undefined,
    status: 'VALIDATED',
  };
}

function safeCurrency(code?: string): CurrencyCode {
  return code !== undefined && isCurrencyCode(code) ? code : 'XOF';
}

function TransactionFormHeader({ type }: Readonly<{ type: 'INCOME' | 'EXPENSE' }>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <header className="flex flex-col gap-2">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/finance/transactions">
          <ArrowLeft aria-hidden="true" className="mr-1 size-4" />
          {t('transactions.backToList')}
        </Link>
      </Button>
      <h1 className="text-h1">
        {type === 'INCOME' ? t('transactionForm.titleIncome') : t('transactionForm.titleExpense')}
      </h1>
    </header>
  );
}

function initialFormState(type: 'INCOME' | 'EXPENSE'): FormState {
  return {
    type,
    accountId: '',
    amount: '0',
    valueDate: new Date().toISOString().slice(0, 10),
    categoryId: '',
    counterpartyId: '',
    description: '',
    notes: '',
  };
}

function useTransactionFormSubmit(
  form: FormState,
  currency: CurrencyCode,
  online: boolean,
  idempotencyKey: string,
) {
  const { t } = useTranslation('finance');
  const navigate = useNavigate();
  const mutation = useFinanceMutation(
    (input: CreateTransactionInput) => financeApi.createTransaction(input, idempotencyKey),
    { successMessage: t('transactionForm.createdSuccess') },
  );

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (!online || !form.accountId || form.amount.trim() === '' || form.amount === '0') return;
    const payload = buildTransactionPayload(form, currency);
    void mutation.mutateAsync(payload).then(() => {
      void navigate('/finance/transactions');
    });
  };

  const isInvalid = !online || !form.accountId || form.amount.trim() === '' || form.amount === '0';

  return { mutation, handleSubmit, isInvalid };
}

export function TransactionFormPage(): JSX.Element {
  const { t } = useTranslation('finance');
  const [params] = useSearchParams();
  const online = useOnlineStatus();
  const [idempotencyKey] = useState(uuidv7);

  const initialType = params.get('type') === 'INCOME' ? 'INCOME' : 'EXPENSE';
  const [form, setForm] = useState<FormState>(() => initialFormState(initialType));

  const accounts = useFinanceAccounts({ archived: false }).data?.data ?? [];
  const selectedAccount = accounts.find((a) => a.id === form.accountId);
  const currency = safeCurrency(selectedAccount?.currency);

  const { mutation, handleSubmit, isInvalid } = useTransactionFormSubmit(
    form,
    currency,
    online,
    idempotencyKey,
  );

  return (
    <main className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl">
      <TransactionFormHeader type={form.type} />
      {!online && (
        <Card className="border-warning bg-warning-surface p-3 text-warning">{t('offlineWarning')}</Card>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AccountAndAmountFields
          state={form}
          currency={currency}
          onChange={(p) => {
            setForm((c) => ({ ...c, ...p }));
          }}
        />
        <ClassificationFields
          state={form}
          onChange={(p) => {
            setForm((c) => ({ ...c, ...p }));
          }}
        />
        <DetailsFields
          state={form}
          onChange={(p) => {
            setForm((c) => ({ ...c, ...p }));
          }}
        />
        <Button type="submit" disabled={mutation.isPending || isInvalid} className="mt-2">
          {mutation.isPending ? t('transactionForm.saving') : t('transactionForm.save')}
        </Button>
      </form>
    </main>
  );
}
