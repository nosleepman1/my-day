import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import {
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  type TransactionResponse,
  type TransactionStatus,
  type TransactionType,
} from '@orbit/contracts';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { EmptyState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/misc';

import { useFinanceAccounts, useFinanceTransactions } from '../api/hooks';
import { NativeSelect, PageHeader, useDates } from '../components/common';

type FiltersState = Readonly<{
  type: string;
  status: string;
  accountId: string;
}>;

function TypeAndStatusFilterSelects({
  filters,
  onChange,
}: Readonly<{
  filters: FiltersState;
  onChange: (patch: Partial<FiltersState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <>
      <NativeSelect
        id="filter-type"
        aria-label={t('transactions.type')}
        value={filters.type}
        onChange={(e) => {
          onChange({ type: e.target.value });
        }}
        options={[
          { value: '', label: t('transactions.allTypes') },
          ...TRANSACTION_TYPES.map((type) => ({ value: type, label: t(`transactions.types.${type}`) })),
        ]}
      />
      <NativeSelect
        id="filter-status"
        aria-label={t('transactions.status')}
        value={filters.status}
        onChange={(e) => {
          onChange({ status: e.target.value });
        }}
        options={[
          { value: '', label: t('transactions.allStatuses') },
          ...TRANSACTION_STATUSES.map((status) => ({
            value: status,
            label: t(`transactions.statuses.${status}`),
          })),
        ]}
      />
    </>
  );
}

function TransactionFilters({
  filters,
  onChange,
}: Readonly<{
  filters: FiltersState;
  onChange: (patch: Partial<FiltersState>) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  const accounts = useFinanceAccounts().data?.data ?? [];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <TypeAndStatusFilterSelects filters={filters} onChange={onChange} />
      <NativeSelect
        id="filter-account"
        aria-label={t('transactions.account')}
        value={filters.accountId}
        onChange={(e) => {
          onChange({ accountId: e.target.value });
        }}
        options={[
          { value: '', label: t('transactions.allAccounts') },
          ...accounts.map((acc) => ({ value: acc.id, label: acc.name })),
        ]}
      />
    </div>
  );
}

function statusTone(status: TransactionStatus): 'success' | 'warning' | 'danger' {
  if (status === 'VALIDATED') return 'success';
  if (status === 'PENDING') return 'warning';
  return 'danger';
}

function TransactionItem({ tx }: Readonly<{ tx: TransactionResponse }>): JSX.Element {
  const { t } = useTranslation('finance');
  const dates = useDates();
  const isCancelled = tx.status === 'CANCELLED';

  return (
    <li>
      <Card className="flex flex-col gap-2 p-4 transition-colors hover:bg-surface-elevated">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Link
              to={`/finance/transactions/${tx.id}`}
              className="text-body-strong text-foreground hover:underline"
            >
              {tx.description ?? t(`transactions.types.${tx.type}`)}
            </Link>
            <span className="text-caption text-muted-foreground">{dates.civil(tx.valueDate)}</span>
          </div>
          <MoneyAmount
            minor={tx.amountMinor}
            currency={tx.currency}
            kind={tx.type === 'EXPENSE' ? 'out' : tx.type === 'INCOME' ? 'in' : 'neutral'}
            className={isCancelled ? 'line-through opacity-60' : ''}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge tone="neutral">{t(`transactions.types.${tx.type}`)}</Badge>
          <Badge tone={statusTone(tx.status)}>{t(`transactions.statuses.${tx.status}`)}</Badge>
        </div>
      </Card>
    </li>
  );
}

function TransactionsList({
  transactions,
}: Readonly<{ transactions: readonly TransactionResponse[] }>): JSX.Element {
  const { t } = useTranslation('finance');
  if (transactions.length === 0) {
    return <EmptyState title={t('transactions.empty')} body={t('transactions.emptyBody')} />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {transactions.map((tx) => (
        <TransactionItem key={tx.id} tx={tx} />
      ))}
    </ul>
  );
}

export function TransactionsPage(): JSX.Element {
  const { t } = useTranslation('finance');
  const [filters, setFilters] = useState<FiltersState>({ type: '', status: '', accountId: '' });

  const queryParams = {
    type: filters.type ? (filters.type as TransactionType) : undefined,
    status: filters.status ? (filters.status as TransactionStatus) : undefined,
    accountId: filters.accountId || undefined,
  };

  const { data, isLoading } = useFinanceTransactions(queryParams);
  const transactions = data?.data ?? [];

  return (
    <main className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title={t('transactions.title')}>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="primary">
            <Link to="/finance/transactions/new?type=EXPENSE">
              <ArrowUpRight aria-hidden="true" className="mr-1 size-4" />
              {t('overview.newExpense')}
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/finance/transactions/new?type=INCOME">
              <ArrowDownLeft aria-hidden="true" className="mr-1 size-4" />
              {t('overview.newIncome')}
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/finance/transfers/new">
              <ArrowLeftRight aria-hidden="true" className="mr-1 size-4" />
              {t('overview.newTransfer')}
            </Link>
          </Button>
        </div>
      </PageHeader>
      <TransactionFilters
        filters={filters}
        onChange={(patch) => {
          setFilters((c) => ({ ...c, ...patch }));
        }}
      />
      {isLoading ? <LoadingState /> : <TransactionsList transactions={transactions} />}
    </main>
  );
}
