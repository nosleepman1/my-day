import { ArrowLeft } from 'lucide-react';
import { useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import type {
  AccountResponse,
  CategoryResponse,
  CounterpartyResponse,
  CreateRecurringTransactionInput,
} from '@orbit/contracts';
import { CURRENCIES, isCurrencyCode, type CurrencyCode } from '@orbit/money';

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

const CURRENCY_LIST = Object.keys(CURRENCIES) as CurrencyCode[];

interface FormState {
  name: string;
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  amount: string;
  currency: CurrencyCode;
  accountId: string;
  destinationAccountId: string;
  categoryId: string;
  counterpartyId: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  anchorOn: string;
  notes: string;
}

function initialFormState(): FormState {
  return {
    name: '',
    type: 'EXPENSE',
    amount: '',
    currency: 'XOF',
    accountId: '',
    destinationAccountId: '',
    categoryId: '',
    counterpartyId: '',
    frequency: 'MONTHLY',
    interval: 1,
    anchorOn: new Date().toISOString().slice(0, 10),
    notes: '',
  };
}

function RecurringFormNameField({
  name,
  onChange,
}: Readonly<{
  name: string;
  onChange: (updater: (prev: FormState) => FormState) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="rec-name">{t('recurringForm.name')}</Label>
      <Input
        id="rec-name"
        required
        maxLength={120}
        placeholder={t('recurringForm.namePlaceholder')}
        value={name}
        onChange={(e) => {
          onChange((prev) => ({ ...prev, name: e.target.value }));
        }}
      />
    </div>
  );
}

function RecurringFormTypeAndCurrency({
  type,
  currency,
  onChange,
}: Readonly<{
  type: FormState['type'];
  currency: FormState['currency'];
  onChange: (updater: (prev: FormState) => FormState) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="rec-type">{t('recurringForm.type')}</Label>
        <NativeSelect
          id="rec-type"
          value={type}
          onChange={(e) => {
            onChange((prev) => ({
              ...prev,
              type: e.target.value as 'EXPENSE' | 'INCOME' | 'TRANSFER',
            }));
          }}
          options={[
            { value: 'EXPENSE', label: t('recurringForm.typeExpense') },
            { value: 'INCOME', label: t('recurringForm.typeIncome') },
            { value: 'TRANSFER', label: t('recurringForm.typeTransfer') },
          ]}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="rec-currency">{t('recurringForm.currency')}</Label>
        <NativeSelect
          id="rec-currency"
          value={currency}
          onChange={(e) => {
            const val = e.target.value;
            if (isCurrencyCode(val)) {
              onChange((prev) => ({ ...prev, currency: val }));
            }
          }}
          options={CURRENCY_LIST.map((c) => ({ value: c, label: c }))}
        />
      </div>
    </div>
  );
}

function RecurringFormIdentityFields({
  form,
  onChange,
}: Readonly<{
  form: FormState;
  onChange: (updater: (prev: FormState) => FormState) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <>
      <RecurringFormNameField name={form.name} onChange={onChange} />
      <RecurringFormTypeAndCurrency type={form.type} currency={form.currency} onChange={onChange} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="rec-amount">{t('recurringForm.amount')}</Label>
        <MoneyInput
          id="rec-amount"
          value={form.amount}
          onValueChange={(val) => {
            onChange((prev) => ({ ...prev, amount: val }));
          }}
          currency={form.currency}
        />
      </div>
    </>
  );
}

function RecurringFormAccountFields({
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="rec-account">{t('recurringForm.account')}</Label>
        <NativeSelect
          id="rec-account"
          required
          value={form.accountId}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, accountId: e.target.value }));
          }}
          options={[
            { value: '', label: t('transactions.allAccounts') },
            ...accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` })),
          ]}
        />
      </div>

      {form.type === 'TRANSFER' && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="rec-dest-account">{t('recurringForm.destinationAccount')}</Label>
          <NativeSelect
            id="rec-dest-account"
            required
            value={form.destinationAccountId}
            onChange={(e) => {
              onChange((prev) => ({ ...prev, destinationAccountId: e.target.value }));
            }}
            options={[
              { value: '', label: t('recurringForm.selectDestinationAccount') },
              ...accounts
                .filter((a) => a.id !== form.accountId)
                .map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` })),
            ]}
          />
        </div>
      )}
    </div>
  );
}

function RecurringFormClassificationFields({
  form,
  onChange,
  categories,
  counterparties,
}: Readonly<{
  form: FormState;
  onChange: (updater: (prev: FormState) => FormState) => void;
  categories: CategoryResponse[];
  counterparties: CounterpartyResponse[];
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="rec-cat">{t('recurringForm.category')}</Label>
        <NativeSelect
          id="rec-cat"
          value={form.categoryId}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, categoryId: e.target.value }));
          }}
          options={[
            { value: '', label: t('recurringForm.selectCategory') },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="rec-cp">{t('recurringForm.counterparty')}</Label>
        <NativeSelect
          id="rec-cp"
          value={form.counterpartyId}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, counterpartyId: e.target.value }));
          }}
          options={[
            { value: '', label: t('recurringForm.selectCounterparty') },
            ...counterparties.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>
    </div>
  );
}

function RecurringFormScheduleFields({
  form,
  onChange,
}: Readonly<{
  form: FormState;
  onChange: (updater: (prev: FormState) => FormState) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="rec-freq">{t('recurringForm.frequency')}</Label>
        <NativeSelect
          id="rec-freq"
          value={form.frequency}
          onChange={(e) => {
            onChange((prev) => ({
              ...prev,
              frequency: e.target.value as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
            }));
          }}
          options={[
            { value: 'DAILY', label: t('recurringForm.frequencyDaily') },
            { value: 'WEEKLY', label: t('recurringForm.frequencyWeekly') },
            { value: 'MONTHLY', label: t('recurringForm.frequencyMonthly') },
            { value: 'YEARLY', label: t('recurringForm.frequencyYearly') },
          ]}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="rec-anchor">{t('recurringForm.anchorOn')}</Label>
        <Input
          id="rec-anchor"
          type="date"
          required
          value={form.anchorOn}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, anchorOn: e.target.value }));
          }}
        />
      </div>
    </div>
  );
}

function buildCreateRecurringPayload(form: FormState): CreateRecurringTransactionInput {
  const amountMinor = moneyInputToMinor(form.amount, form.currency);
  const recurrenceRule = `FREQ=${form.frequency};INTERVAL=${form.interval}`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Dakar';
  const economicClass =
    form.type === 'TRANSFER'
      ? 'INTERNAL_TRANSFER'
      : form.type === 'INCOME'
        ? 'INCOME_OPERATING'
        : 'EXPENSE_OPERATING';

  return {
    name: form.name.trim(),
    type: form.type,
    economicClass,
    amountMinor,
    currency: form.currency,
    accountId: form.accountId,
    destinationAccountId: form.type === 'TRANSFER' ? form.destinationAccountId : undefined,
    categoryId: form.categoryId || undefined,
    counterpartyId: form.counterpartyId || undefined,
    recurrenceRule,
    recurrenceAnchorOn: form.anchorOn,
    recurrenceTimezone: tz,
    notes: form.notes.trim() ? form.notes.trim() : undefined,
  };
}

function isRecurringFormInvalid(form: FormState, online: boolean): boolean {
  if (!online) return true;
  if (!form.name.trim()) return true;
  if (!form.accountId) return true;
  if (form.amount.trim() === '' || form.amount === '0') return true;
  if (
    form.type === 'TRANSFER' &&
    (!form.destinationAccountId || form.destinationAccountId === form.accountId)
  ) {
    return true;
  }
  return false;
}

function RecurringFormHeader(): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <header className="flex flex-col gap-2">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/finance/recurring">
          <ArrowLeft aria-hidden="true" className="mr-1 size-4" />
          {t('recurring.backToList')}
        </Link>
      </Button>
      <h1 className="text-h1">{t('recurringForm.titleCreate')}</h1>
    </header>
  );
}

function RecurringFormSubmitButtons({
  isInvalid,
  isPending,
}: Readonly<{ isInvalid: boolean; isPending: boolean }>): JSX.Element {
  const { t } = useTranslation('common');

  return (
    <div className="flex justify-end gap-3">
      <Button asChild variant="secondary">
        <Link to="/finance/recurring">{t('actions.cancel')}</Link>
      </Button>
      <Button type="submit" disabled={isInvalid || isPending}>
        {isPending ? t('states.loading') : t('actions.confirm')}
      </Button>
    </div>
  );
}

export function RecurringFormPage(): JSX.Element {
  const { t } = useTranslation('finance');
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [form, setForm] = useState<FormState>(initialFormState);

  const accounts = useFinanceAccounts({ archived: false }).data?.data ?? [];
  const categories = useFinanceCategories().data?.data ?? [];
  const counterparties = useFinanceCounterparties().data?.data ?? [];

  const mutation = useFinanceMutation(
    (input: CreateRecurringTransactionInput) => financeApi.createRecurringTransaction(input, uuidv7()),
    { successMessage: t('recurringForm.createdSuccess') },
  );

  const isInvalid = isRecurringFormInvalid(form, online);

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (isInvalid) return;

    const payload = buildCreateRecurringPayload(form);
    void mutation.mutateAsync(payload).then(() => {
      void navigate('/finance/recurring');
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <RecurringFormHeader />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4 p-5">
          <RecurringFormIdentityFields form={form} onChange={setForm} />
          <RecurringFormAccountFields form={form} onChange={setForm} accounts={accounts} />
          <RecurringFormClassificationFields
            form={form}
            onChange={setForm}
            categories={categories}
            counterparties={counterparties}
          />
          <RecurringFormScheduleFields form={form} onChange={setForm} />
        </Card>

        <RecurringFormSubmitButtons isInvalid={isInvalid} isPending={mutation.isPending} />
      </form>
    </div>
  );
}
