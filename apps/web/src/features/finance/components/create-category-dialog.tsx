import { useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { CategoryKind, CreateCategory } from '@orbit/contracts';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { financeApi } from '../api/finance.api';
import { useFinanceMutation } from '../api/hooks';

import { NativeSelect } from './common';

type CreateCategoryDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultKind?: CategoryKind;
}>;

interface CategoryFormState {
  name: string;
  kind: CategoryKind;
  color: string;
}

function CategoryInputs({
  form,
  onChange,
}: Readonly<{
  form: CategoryFormState;
  onChange: (patch: Partial<CategoryFormState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cat-name">{t('categories.name')}</Label>
        <Input
          id="cat-name"
          required
          value={form.name}
          onChange={(e) => {
            onChange({ name: e.target.value });
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cat-kind">{t('transactions.type')}</Label>
        <NativeSelect
          id="cat-kind"
          value={form.kind}
          onChange={(e) => {
            onChange({ kind: e.target.value as CategoryKind });
          }}
          options={[
            { value: 'EXPENSE', label: t('transactions.types.EXPENSE') },
            { value: 'INCOME', label: t('transactions.types.INCOME') },
          ]}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cat-color">{t('categories.color')}</Label>
        <Input
          id="cat-color"
          type="color"
          className="h-10 w-20 cursor-pointer p-1"
          value={form.color}
          onChange={(e) => {
            onChange({ color: e.target.value });
          }}
        />
      </div>
    </>
  );
}

export function CreateCategoryDialog({
  open,
  onOpenChange,
  defaultKind = 'EXPENSE',
}: CreateCategoryDialogProps): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  const [form, setForm] = useState<CategoryFormState>({
    name: '',
    kind: defaultKind,
    color: '#0284c7',
  });

  const mutation = useFinanceMutation((input: CreateCategory) => financeApi.createCategory(input), {
    successMessage: t('categories.createdSuccess'),
  });

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (form.name.trim() === '') return;
    const defaultEconomicClass = form.kind === 'EXPENSE' ? 'EXPENSE_OPERATING' : 'INCOME_OPERATING';
    void mutation
      .mutateAsync({
        name: form.name.trim(),
        kind: form.kind,
        defaultEconomicClass,
        color: form.color,
      })
      .then(() => {
        onOpenChange(false);
        setForm({ name: '', kind: defaultKind, color: '#0284c7' });
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common:actions.close')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('categories.new')}</DialogTitle>
          </DialogHeader>
          <CategoryInputs
            form={form}
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
            <Button type="submit" disabled={mutation.isPending || form.name.trim() === ''}>
              {mutation.isPending ? t('common:states.loading') : t('common:actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
