import { ArrowLeft } from 'lucide-react';
import { useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import type { AccountResponse, CounterpartyResponse, CreateDebtInput, DebtType } from '@orbit/contracts';
import { CURRENCIES, isCurrencyCode, type CurrencyCode } from '@orbit/money';

import { MoneyInput } from '@/components/forms/money-input';
import { moneyInputToMinor } from '@/components/forms/money-input-value';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { uuidv7 } from '@/lib/ids';

import { financeApi } from '../api/finance.api';
import { useFinanceAccounts, useFinanceCounterparties, useFinanceMutation } from '../api/hooks';
import { NativeSelect } from '../components/common';

const CURRENCY_LIST = Object.keys(CURRENCIES) as CurrencyCode[];

interface FormState {
  type: DebtType;
  title: string;
  counterpartyId: string;
  amount: string;
  currency: CurrencyCode;
  openedOn: string;
  dueDate: string;
  description: string;
  notes: string;
  recordInitialMovement: boolean;
  initialAccountId: string;
  initialValueDate: string;
}

function initialFormState(): FormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    type: 'PAYABLE',
    title: '',
    counterpartyId: '',
    amount: '',
    currency: 'XOF',
    openedOn: today,
    dueDate: '',
    description: '',
    notes: '',
    recordInitialMovement: false,
    initialAccountId: '',
    initialValueDate: today,
  };
}

function isDebtFormInvalid(form: FormState, online: boolean): boolean {
  if (!online) return true;
  if (!form.title.trim()) return true;
  if (!form.counterpartyId) return true;
  if (form.amount.trim() === '' || form.amount === '0') return true;
  if (form.recordInitialMovement && !form.initialAccountId) return true;
  return false;
}

function buildCreateDebtPayload(form: FormState): CreateDebtInput {
  const principalMinor = moneyInputToMinor(form.amount, form.currency);
  return {
    type: form.type,
    title: form.title.trim(),
    counterpartyId: form.counterpartyId,
    principalMinor,
    currency: form.currency,
    openedOn: form.openedOn,
    dueDate: form.dueDate ? form.dueDate : undefined,
    description: form.description.trim() ? form.description.trim() : undefined,
    notes: form.notes.trim() ? form.notes.trim() : undefined,
    initialMovement: form.recordInitialMovement
      ? {
          accountId: form.initialAccountId,
          valueDate: form.initialValueDate || form.openedOn,
        }
      : undefined,
  };
}

function DebtFormTypeTitleFields({
  form,
  onChange,
}: Readonly<{
  form: FormState;
  onChange: (updater: (prev: FormState) => FormState) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <>
      <div className="flex flex-col gap-1">
        <Label htmlFor="debt-type">{t('debtForm.type')}</Label>
        <NativeSelect
          id="debt-type"
          value={form.type}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, type: e.target.value as DebtType }));
          }}
          options={[
            { value: 'PAYABLE', label: t('debtForm.typePayable') },
            { value: 'RECEIVABLE', label: t('debtForm.typeReceivable') },
          ]}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="debt-title">{t('debtForm.title')}</Label>
        <Input
          id="debt-title"
          required
          maxLength={160}
          placeholder={t('debtForm.titlePlaceholder')}
          value={form.title}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, title: e.target.value }));
          }}
        />
      </div>
    </>
  );
}

function DebtFormCounterpartyField({
  form,
  onChange,
  counterparties,
}: Readonly<{
  form: FormState;
  onChange: (updater: (prev: FormState) => FormState) => void;
  counterparties: CounterpartyResponse[];
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="debt-counterparty">{t('debtForm.counterparty')}</Label>
      <NativeSelect
        id="debt-counterparty"
        required
        value={form.counterpartyId}
        onChange={(e) => {
          onChange((prev) => ({ ...prev, counterpartyId: e.target.value }));
        }}
        options={[
          { value: '', label: t('debtForm.selectCounterparty') },
          ...counterparties.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
    </div>
  );
}

function DebtFormAmountCurrencyFields({
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
        <Label htmlFor="debt-amount">{t('debtForm.amount')}</Label>
        <MoneyInput
          id="debt-amount"
          value={form.amount}
          onValueChange={(val) => {
            onChange((prev) => ({ ...prev, amount: val }));
          }}
          currency={form.currency}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="debt-currency">{t('debtForm.currency')}</Label>
        <NativeSelect
          id="debt-currency"
          value={form.currency}
          onChange={(e) => {
            const val = e.target.value;
            if (isCurrencyCode(val)) {
              onChange((prev) => ({ ...prev, currency: val }));
            }
          }}
          options={CURRENCY_LIST.map((code) => ({ value: code, label: code }))}
        />
      </div>
    </div>
  );
}

function DebtFormDatesFields({
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
        <Label htmlFor="debt-opened-on">{t('debtForm.openedOn')}</Label>
        <Input
          id="debt-opened-on"
          type="date"
          required
          value={form.openedOn}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, openedOn: e.target.value }));
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="debt-due-date">{t('debtForm.dueDate')}</Label>
        <Input
          id="debt-due-date"
          type="date"
          min={form.openedOn}
          value={form.dueDate}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, dueDate: e.target.value }));
          }}
        />
      </div>
    </div>
  );
}

function DebtFormNotesFields({
  form,
  onChange,
}: Readonly<{
  form: FormState;
  onChange: (updater: (prev: FormState) => FormState) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <>
      <div className="flex flex-col gap-1">
        <Label htmlFor="debt-description">{t('debtForm.description')}</Label>
        <Input
          id="debt-description"
          placeholder={t('debtForm.descriptionPlaceholder')}
          value={form.description}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, description: e.target.value }));
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="debt-notes">{t('debtForm.notes')}</Label>
        <Input
          id="debt-notes"
          placeholder={t('debtForm.notesPlaceholder')}
          value={form.notes}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, notes: e.target.value }));
          }}
        />
      </div>
    </>
  );
}

function InitialMovementAccountDateGrid({
  form,
  onChange,
  eligibleAccounts,
}: Readonly<{
  form: FormState;
  onChange: (updater: (prev: FormState) => FormState) => void;
  eligibleAccounts: AccountResponse[];
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="initial-account">{t('debtForm.initialAccount')}</Label>
        <NativeSelect
          id="initial-account"
          required
          value={form.initialAccountId}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, initialAccountId: e.target.value }));
          }}
          options={[
            { value: '', label: t('debtForm.selectAccount') },
            ...eligibleAccounts.map((a) => ({
              value: a.id,
              label: `${a.name} (${a.currency})`,
            })),
          ]}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="initial-date">{t('debtForm.initialValueDate')}</Label>
        <Input
          id="initial-date"
          type="date"
          value={form.initialValueDate}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, initialValueDate: e.target.value }));
          }}
        />
      </div>
    </div>
  );
}

function DebtFormInitialMovementFields({
  form,
  onChange,
  eligibleAccounts,
}: Readonly<{
  form: FormState;
  onChange: (updater: (prev: FormState) => FormState) => void;
  eligibleAccounts: AccountResponse[];
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <Card className="flex flex-col gap-4 p-5 bg-surface-muted/30">
      <div className="flex items-center gap-2">
        <Checkbox
          id="initial-movement-check"
          checked={form.recordInitialMovement}
          onCheckedChange={(checked) => {
            onChange((prev) => ({ ...prev, recordInitialMovement: checked === true }));
          }}
        />
        <Label htmlFor="initial-movement-check" className="text-body font-medium cursor-pointer">
          {t('debtForm.initialMovementCheck')}
        </Label>
      </div>

      {form.recordInitialMovement && (
        <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
          <p className="text-caption text-muted-foreground">
            {form.type === 'PAYABLE'
              ? t('debtForm.initialMovementPayableHint')
              : t('debtForm.initialMovementReceivableHint')}
          </p>

          <InitialMovementAccountDateGrid
            form={form}
            onChange={onChange}
            eligibleAccounts={eligibleAccounts}
          />
        </div>
      )}
    </Card>
  );
}

function DebtFormHeader(): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <header className="flex flex-col gap-2">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/finance/debts">
          <ArrowLeft aria-hidden="true" className="mr-1 size-4" />
          {t('debts.backToList')}
        </Link>
      </Button>
      <h1 className="text-h1">{t('debtForm.titleCreate')}</h1>
    </header>
  );
}

function DebtFormSubmitActions({
  disabled,
  isPending,
}: Readonly<{ disabled: boolean; isPending: boolean }>): JSX.Element {
  const { t } = useTranslation('common');

  return (
    <div className="flex justify-end gap-3">
      <Button asChild variant="secondary">
        <Link to="/finance/debts">{t('actions.cancel')}</Link>
      </Button>
      <Button type="submit" disabled={disabled}>
        {isPending ? t('states.loading') : t('actions.confirm')}
      </Button>
    </div>
  );
}

export function DebtFormPage(): JSX.Element {
  const { t } = useTranslation('finance');
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [form, setForm] = useState<FormState>(initialFormState);

  const counterparties = useFinanceCounterparties().data?.data ?? [];
  const accounts = useFinanceAccounts({ archived: false }).data?.data ?? [];
  const matchingAccounts = accounts.filter((a) => a.currency === form.currency);
  const eligibleAccounts = matchingAccounts.length > 0 ? matchingAccounts : accounts;

  const mutation = useFinanceMutation((input: CreateDebtInput) => financeApi.createDebt(input, uuidv7()), {
    successMessage: t('debtForm.createdSuccess'),
  });

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (isDebtFormInvalid(form, online)) return;

    const payload = buildCreateDebtPayload(form);
    void mutation.mutateAsync(payload).then((res) => {
      void navigate(`/finance/debts/${res.data.id}`);
    });
  };

  const isInvalid = isDebtFormInvalid(form, online);

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <DebtFormHeader />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4 p-5">
          <DebtFormTypeTitleFields form={form} onChange={setForm} />
          <DebtFormCounterpartyField form={form} onChange={setForm} counterparties={counterparties} />
          <DebtFormAmountCurrencyFields form={form} onChange={setForm} />
          <DebtFormDatesFields form={form} onChange={setForm} />
          <DebtFormNotesFields form={form} onChange={setForm} />
        </Card>

        <DebtFormInitialMovementFields form={form} onChange={setForm} eligibleAccounts={eligibleAccounts} />

        <DebtFormSubmitActions disabled={isInvalid || mutation.isPending} isPending={mutation.isPending} />
      </form>
    </div>
  );
}
