import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Plus, AlertCircle } from 'lucide-react';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { AccountResponse, TransactionResponse } from '@orbit/contracts';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { EmptyState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { useFinanceAccounts, useFinanceBalancesReport, useFinanceTransactions } from '../api/hooks';
import { AccountCard } from '../components/account-card';
import { AccountFormDialog } from '../components/account-form-dialog';
import { PageHeader, useDates } from '../components/common';
import { CurrencyTotals } from '../components/currency-totals';

function QuickActionBar({ onNewAccount }: Readonly<{ onNewAccount: () => void }>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
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
      <Button variant="ghost" onClick={onNewAccount}>
        <Plus aria-hidden="true" className="mr-1 size-4" />
        {t('overview.newAccount')}
      </Button>
    </div>
  );
}

function PendingAlert({ count }: Readonly<{ count: number }>): JSX.Element | null {
  const { t } = useTranslation('finance');
  if (count <= 0) return null;
  return (
    <Card className="flex items-center gap-3 border-warning bg-surface p-4 text-warning">
      <AlertCircle aria-hidden="true" className="size-5 shrink-0" />
      <div className="flex flex-1 flex-col">
        <span className="text-body-strong">{t('overview.pendingCount', { count })}</span>
        <span className="text-caption text-muted-foreground">{t('overview.pendingAlert')}</span>
      </div>
      <Button asChild variant="secondary" size="sm">
        <Link to="/finance/transactions?status=PENDING">{t('overview.pending')}</Link>
      </Button>
    </Card>
  );
}

function RecentTransactionsList({
  transactions,
}: Readonly<{ transactions: readonly TransactionResponse[] }>): JSX.Element {
  const { t } = useTranslation('finance');
  const dates = useDates();
  if (transactions.length === 0) {
    return <p className="text-caption text-muted-foreground">{t('overview.noRecentTransactions')}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {transactions.map((tx) => (
        <li key={tx.id} className="flex items-center justify-between py-2">
          <div className="flex flex-col">
            <Link to={`/finance/transactions/${tx.id}`} className="text-body hover:underline">
              {tx.description ?? t(`transactions.types.${tx.type}`)}
            </Link>
            <span className="text-caption text-muted-foreground">{dates.civil(tx.valueDate)}</span>
          </div>
          <MoneyAmount
            minor={tx.amountMinor}
            currency={tx.currency}
            kind={tx.type === 'INCOME' ? 'in' : tx.type === 'EXPENSE' ? 'out' : 'neutral'}
          />
        </li>
      ))}
    </ul>
  );
}

function AccountsListSection({ accounts }: Readonly<{ accounts: readonly AccountResponse[] }>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-h3">{t('overview.accounts')}</h2>
        <Button asChild variant="ghost" size="sm">
          <Link to="/finance/accounts">{t('overview.viewAllAccounts')}</Link>
        </Button>
      </div>
      {accounts.length === 0 ? (
        <EmptyState title={t('accounts.empty')} body={t('accounts.emptyBody')} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <AccountCard key={acc.id} account={acc} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentSection({
  transactions,
}: Readonly<{ transactions: readonly TransactionResponse[] }>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-h3">{t('overview.recentTransactions')}</h2>
        <Button asChild variant="ghost" size="sm">
          <Link to="/finance/transactions">{t('overview.viewAllTransactions')}</Link>
        </Button>
      </div>
      <Card className="p-4">
        <RecentTransactionsList transactions={transactions} />
      </Card>
    </div>
  );
}

export function FinanceOverviewPage(): JSX.Element {
  const { t } = useTranslation('finance');
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const accountsQuery = useFinanceAccounts({ archived: false });
  const balancesQuery = useFinanceBalancesReport();
  const pendingQuery = useFinanceTransactions({ status: 'PENDING' });
  const recentQuery = useFinanceTransactions({ limit: 5 });

  if (accountsQuery.isPending || balancesQuery.isPending) {
    return <LoadingState />;
  }

  const accounts = accountsQuery.data?.data ?? [];
  const totals = balancesQuery.data?.data.totalsByCurrency ?? {};
  const pendingCount = pendingQuery.data?.data.length ?? 0;
  const recentTransactions = recentQuery.data?.data ?? [];

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('overview.title')}>
        <QuickActionBar
          onNewAccount={() => {
            setAccountDialogOpen(true);
          }}
        />
      </PageHeader>
      <PendingAlert count={pendingCount} />
      <CurrencyTotals totalsByCurrency={totals} />
      <AccountsListSection accounts={accounts} />
      <RecentSection transactions={recentTransactions} />
      <AccountFormDialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen} />
    </section>
  );
}
