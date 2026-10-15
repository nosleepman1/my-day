import { useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { CounterpartyKind, CreateCounterparty } from '@orbit/contracts';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { financeApi } from '../api/finance.api';
import { useFinanceMutation } from '../api/hooks';

import { NativeSelect } from './common';

type CreateCounterpartyDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

interface CounterpartyFormState {
  name: string;
  kind: CounterpartyKind;
  notes: string;
}

function CounterpartyInputs({
  form,
  onChange,
}: Readonly<{
  form: CounterpartyFormState;
  onChange: (patch: Partial<CounterpartyFormState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cp-name">{t('counterparties.name')}</Label>
        <Input
          id="cp-name"
          required
          placeholder={t('counterparties.namePlaceholder')}
          value={form.name}
          onChange={(e) => {
            onChange({ name: e.target.value });
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cp-kind">{t('transactions.type')}</Label>
        <NativeSelect
          id="cp-kind"
          value={form.kind}
          onChange={(e) => {
            onChange({ kind: e.target.value as CounterpartyKind });
          }}
          options={[
            { value: 'PERSON', label: t('counterparties.person') },
            { value: 'ORGANIZATION', label: t('counterparties.organization') },
          ]}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cp-notes">{t('accountForm.notes')}</Label>
        <Input
          id="cp-notes"
          value={form.notes}
          onChange={(e) => {
            onChange({ notes: e.target.value });
          }}
        />
      </div>
    </>
  );
}

function useCounterpartySubmit(
  form: CounterpartyFormState,
  setForm: (fn: (c: CounterpartyFormState) => CounterpartyFormState) => void,
  onOpenChange: (open: boolean) => void,
) {
  const { t } = useTranslation(['finance', 'common']);
  const mutation = useFinanceMutation((input: CreateCounterparty) => financeApi.createCounterparty(input), {
    successMessage: t('counterparties.createdSuccess'),
  });

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (form.name.trim() === '') return;
    const payload: CreateCounterparty = {
      name: form.name.trim(),
      kind: form.kind,
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };
    void mutation.mutateAsync(payload).then(() => {
      onOpenChange(false);
      setForm(() => ({ name: '', kind: 'PERSON', notes: '' }));
    });
  };

  return { handleSubmit, isPending: mutation.isPending };
}

function CounterpartyDialogFooter({
  onCancel,
  isPending,
  disabled,
}: Readonly<{ onCancel: () => void; isPending: boolean; disabled: boolean }>): JSX.Element {
  const { t } = useTranslation('common');
  return (
    <DialogFooter>
      <Button variant="secondary" type="button" onClick={onCancel}>
        {t('actions.cancel')}
      </Button>
      <Button type="submit" disabled={disabled}>
        {isPending ? t('states.loading') : t('actions.save')}
      </Button>
    </DialogFooter>
  );
}

export function CreateCounterpartyDialog({ open, onOpenChange }: CreateCounterpartyDialogProps): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  const [form, setForm] = useState<CounterpartyFormState>({
    name: '',
    kind: 'PERSON',
    notes: '',
  });

  const { handleSubmit, isPending } = useCounterpartySubmit(form, setForm, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common:actions.close')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('counterparties.new')}</DialogTitle>
          </DialogHeader>
          <CounterpartyInputs
            form={form}
            onChange={(p) => {
              setForm((c) => ({ ...c, ...p }));
            }}
          />
          <CounterpartyDialogFooter
            onCancel={() => {
              onOpenChange(false);
            }}
            isPending={isPending}
            disabled={isPending || form.name.trim() === ''}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
