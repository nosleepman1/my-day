import { useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ACCOUNT_TYPES, type AccountType, type CreateAccountInput } from '@orbit/contracts';
import { CURRENCIES, type CurrencyCode } from '@orbit/money';

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
import { Switch } from '@/components/ui/switch';
import { uuidv7 } from '@/lib/ids';

import { financeApi } from '../api/finance.api';
import { useFinanceMutation } from '../api/hooks';

import { NativeSelect } from './common';

const CURRENCY_LIST = Object.keys(CURRENCIES) as CurrencyCode[];

type AccountFormDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

interface FormState {
  name: string;
  type: AccountType;
  provider: string;
  currency: CurrencyCode;
  openingBalance: string;
  openedOn: string;
  allowOverdraft: boolean;
  overdraftLimit: string;
  includeInNetWorth: boolean;
  notes: string;
  idempotencyKey: string;
}

function initialFormState(): FormState {
  return {
    name: '',
    type: 'BANK',
    provider: '',
    currency: 'XOF',
    openingBalance: '0',
    openedOn: new Date().toISOString().slice(0, 10),
    allowOverdraft: false,
    overdraftLimit: '',
    includeInNetWorth: true,
    notes: '',
    idempotencyKey: uuidv7(),
  };
}

function OverdraftSection({
  allowOverdraft,
  overdraftLimit,
  currency,
  onToggle,
  onLimitChange,
}: Readonly<{
  allowOverdraft: boolean;
  overdraftLimit: string;
  currency: CurrencyCode;
  onToggle: (checked: boolean) => void;
  onLimitChange: (val: string) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <div className="flex flex-col gap-3 rounded-md border border-input-border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="account-allow-overdraft">{t('accountForm.allowOverdraft')}</Label>
        <Switch id="account-allow-overdraft" checked={allowOverdraft} onCheckedChange={onToggle} />
      </div>
      {allowOverdraft && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="account-overdraft-limit">{t('accountForm.overdraftLimit')}</Label>
          <MoneyInput
            id="account-overdraft-limit"
            value={overdraftLimit}
            onValueChange={onLimitChange}
            currency={currency}
          />
        </div>
      )}
    </div>
  );
}

function AccountNameAndProvider({
  state,
  onChange,
}: Readonly<{
  state: FormState;
  onChange: (patch: Partial<FormState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <>
      <div className="flex flex-col gap-1">
        <Label htmlFor="account-name">{t('accountForm.name')}</Label>
        <Input
          id="account-name"
          required
          placeholder={t('accountForm.namePlaceholder')}
          value={state.name}
          onChange={(e) => {
            onChange({ name: e.target.value });
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="account-provider">{t('accountForm.provider')}</Label>
        <Input
          id="account-provider"
          placeholder={t('accountForm.providerPlaceholder')}
          value={state.provider}
          onChange={(e) => {
            onChange({ provider: e.target.value });
          }}
        />
      </div>
    </>
  );
}

function AccountTypeAndCurrency({
  state,
  onChange,
}: Readonly<{
  state: FormState;
  onChange: (patch: Partial<FormState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="account-type">{t('accountForm.type')}</Label>
        <NativeSelect
          id="account-type"
          value={state.type}
          onChange={(e) => {
            onChange({ type: e.target.value as AccountType });
          }}
          options={ACCOUNT_TYPES.map((type) => ({ value: type, label: t(`accounts.types.${type}`) }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="account-currency">{t('accountForm.currency')}</Label>
        <NativeSelect
          id="account-currency"
          value={state.currency}
          onChange={(e) => {
            onChange({ currency: e.target.value as CurrencyCode });
          }}
          options={CURRENCY_LIST.map((code) => ({
            value: code,
            label: `${code} (${CURRENCIES[code].symbol})`,
          }))}
        />
      </div>
    </div>
  );
}

function AccountOpeningFields({
  state,
  onChange,
}: Readonly<{
  state: FormState;
  onChange: (patch: Partial<FormState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="account-opening-balance">{t('accountForm.openingBalance')}</Label>
        <MoneyInput
          id="account-opening-balance"
          value={state.openingBalance}
          onValueChange={(val) => {
            onChange({ openingBalance: val });
          }}
          currency={state.currency}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="account-opened-on">{t('accountForm.openedOn')}</Label>
        <Input
          id="account-opened-on"
          type="date"
          required
          value={state.openedOn}
          onChange={(e) => {
            onChange({ openedOn: e.target.value });
          }}
        />
      </div>
    </div>
  );
}

function buildPayload(form: FormState): CreateAccountInput {
  const openingMinor =
    form.openingBalance.trim() === '' ? '0' : moneyInputToMinor(form.openingBalance, form.currency);
  const overdraftMinor =
    form.allowOverdraft && form.overdraftLimit.trim() !== ''
      ? moneyInputToMinor(form.overdraftLimit, form.currency)
      : undefined;

  return {
    name: form.name.trim(),
    type: form.type,
    currency: form.currency,
    provider: form.provider.trim() || undefined,
    openingBalanceMinor: openingMinor,
    openedOn: form.openedOn,
    allowOverdraft: form.allowOverdraft,
    overdraftLimitMinor: overdraftMinor,
    includeInNetWorth: form.includeInNetWorth,
    notes: form.notes.trim() || undefined,
  };
}

function AccountDialogFooter({
  pending,
  disabled,
  onCancel,
}: Readonly<{
  pending: boolean;
  disabled: boolean;
  onCancel: () => void;
}>): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  return (
    <DialogFooter>
      <Button variant="secondary" type="button" onClick={onCancel}>
        {t('common:actions.cancel')}
      </Button>
      <Button type="submit" disabled={disabled}>
        {pending ? t('accountForm.saving') : t('accountForm.save')}
      </Button>
    </DialogFooter>
  );
}

function AccountFormBody({
  form,
  onChange,
}: Readonly<{
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
}>): JSX.Element {
  return (
    <>
      <AccountNameAndProvider state={form} onChange={onChange} />
      <AccountTypeAndCurrency state={form} onChange={onChange} />
      <AccountOpeningFields state={form} onChange={onChange} />
      <OverdraftSection
        allowOverdraft={form.allowOverdraft}
        overdraftLimit={form.overdraftLimit}
        currency={form.currency}
        onToggle={(checked) => {
          onChange({ allowOverdraft: checked });
        }}
        onLimitChange={(val: string) => {
          onChange({ overdraftLimit: val });
        }}
      />
    </>
  );
}

export function AccountFormDialog({ open, onOpenChange }: AccountFormDialogProps): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  const [form, setForm] = useState<FormState>(initialFormState);
  const createMutation = useFinanceMutation(
    (input: CreateAccountInput) => financeApi.createAccount(input, form.idempotencyKey),
    { successMessage: t('accountForm.createdSuccess') },
  );

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    void createMutation.mutateAsync(buildPayload(form)).then(() => {
      onOpenChange(false);
      setForm(initialFormState());
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common:actions.close')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('accountForm.titleCreate')}</DialogTitle>
            <DialogDescription>{t('accounts.subtitle')}</DialogDescription>
          </DialogHeader>
          <AccountFormBody
            form={form}
            onChange={(p) => {
              setForm((c) => ({ ...c, ...p }));
            }}
          />
          <AccountDialogFooter
            pending={createMutation.isPending}
            disabled={createMutation.isPending || form.name.trim() === ''}
            onCancel={() => {
              onOpenChange(false);
            }}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
