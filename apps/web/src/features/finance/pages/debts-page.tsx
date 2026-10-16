import { Plus } from 'lucide-react';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type {
  CounterpartyResponse,
  DebtResponse,
  DebtStatus,
  DebtType,
  ListDebtsQuery,
} from '@orbit/contracts';

import { EmptyState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import { useFinanceCounterparties, useFinanceDebts, useFinanceDebtSummary } from '../api/hooks';
import { NativeSelect, PageHeader } from '../components/common';
import { DebtCard } from '../components/debt-card';
import { DebtSummaryCards } from '../components/debt-summary-cards';

interface FiltersState {
  type: DebtType | '';
  status: DebtStatus | '';
  counterpartyId: string;
  overdue: boolean;
}

function DebtsTypeTabs({
  currentType,
  onChange,
}: Readonly<{
  currentType: DebtType | '';
  onChange: (type: DebtType | '') => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-3" role="tablist">
      <Button
        variant={currentType === '' ? 'primary' : 'ghost'}
        size="sm"
        role="tab"
        aria-selected={currentType === ''}
        onClick={() => {
          onChange('');
        }}
      >
        {t('debts.all')}
      </Button>
      <Button
        variant={currentType === 'PAYABLE' ? 'primary' : 'ghost'}
        size="sm"
        role="tab"
        aria-selected={currentType === 'PAYABLE'}
        onClick={() => {
          onChange('PAYABLE');
        }}
      >
        {t('debts.payable')}
      </Button>
      <Button
        variant={currentType === 'RECEIVABLE' ? 'primary' : 'ghost'}
        size="sm"
        role="tab"
        aria-selected={currentType === 'RECEIVABLE'}
        onClick={() => {
          onChange('RECEIVABLE');
        }}
      >
        {t('debts.receivable')}
      </Button>
    </div>
  );
}

function DebtsOverdueFilter({
  overdue,
  onChange,
}: Readonly<{
  overdue: boolean;
  onChange: (overdue: boolean) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="filter-overdue"
        checked={overdue}
        onCheckedChange={(checked) => {
          onChange(checked === true);
        }}
      />
      <Label htmlFor="filter-overdue" className="text-body cursor-pointer">
        {t('debts.overdueOnly')}
      </Label>
    </div>
  );
}

function DebtsSecondaryFilters({
  filters,
  onChange,
  counterparties,
}: Readonly<{
  filters: FiltersState;
  onChange: (updater: (prev: FiltersState) => FiltersState) => void;
  counterparties: CounterpartyResponse[];
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 items-center">
      <NativeSelect
        id="filter-counterparty"
        aria-label={t('debts.counterparty')}
        value={filters.counterpartyId}
        onChange={(e) => {
          onChange((prev) => ({ ...prev, counterpartyId: e.target.value }));
        }}
        options={[
          { value: '', label: t('debts.filterAllCounterparties') },
          ...counterparties.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />

      <NativeSelect
        id="filter-status"
        aria-label={t('debts.statusLabel')}
        value={filters.status}
        onChange={(e) => {
          onChange((prev) => ({ ...prev, status: e.target.value as DebtStatus | '' }));
        }}
        options={[
          { value: '', label: t('debts.filterAllStatuses') },
          { value: 'OPEN', label: t('debts.statuses.OPEN') },
          { value: 'CANCELLED', label: t('debts.statuses.CANCELLED') },
          { value: 'WRITTEN_OFF', label: t('debts.statuses.WRITTEN_OFF') },
        ]}
      />

      <DebtsOverdueFilter
        overdue={filters.overdue}
        onChange={(overdue) => {
          onChange((prev) => ({ ...prev, overdue }));
        }}
      />
    </div>
  );
}

function DebtsList({
  isPending,
  debts,
}: Readonly<{ isPending: boolean; debts: DebtResponse[] }>): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);

  if (isPending) return <LoadingState label={t('common:states.loading')} />;
  if (debts.length === 0) {
    return (
      <EmptyState
        title={t('debts.empty')}
        body={t('debts.emptyBody')}
        action={
          <Button asChild>
            <Link to="/finance/debts/new">{t('debts.new')}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {debts.map((debt) => (
        <DebtCard key={debt.id} debt={debt} />
      ))}
    </ul>
  );
}

export function DebtsPage(): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  const [filters, setFilters] = useState<FiltersState>({
    type: '',
    status: '',
    counterpartyId: '',
    overdue: false,
  });

  const queryParams: Partial<ListDebtsQuery> = {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.counterpartyId ? { counterpartyId: filters.counterpartyId } : {}),
    ...(filters.overdue ? { overdue: true } : {}),
  };

  const debtsQuery = useFinanceDebts(queryParams);
  const summaryQuery = useFinanceDebtSummary();
  const counterparties = useFinanceCounterparties().data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('debts.title')}>
        <Button asChild>
          <Link to="/finance/debts/new">
            <Plus aria-hidden="true" className="mr-1.5 size-4" />
            {t('debts.new')}
          </Link>
        </Button>
      </PageHeader>

      <DebtSummaryCards summary={summaryQuery.data?.data} />

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <DebtsTypeTabs
          currentType={filters.type}
          onChange={(type) => {
            setFilters((prev) => ({ ...prev, type }));
          }}
        />
        <DebtsSecondaryFilters filters={filters} onChange={setFilters} counterparties={counterparties} />
      </div>

      <DebtsList isPending={debtsQuery.isPending} debts={debtsQuery.data?.data ?? []} />
    </div>
  );
}
