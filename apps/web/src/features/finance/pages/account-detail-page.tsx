import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import type { AccountResponse, TransactionResponse } from '@orbit/contracts';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/misc';

import { financeApi } from '../api/finance.api';
import { useFinanceAccount, useFinanceMutation, useFinanceTransactions } from '../api/hooks';
import { AdjustBalanceDialog } from '../components/adjust-balance-dialog';
import { ConfirmButton, PageHeader, useDates } from '../components/common';
import { ReconcileDialog } from '../components/reconcile-dialog';

function AccountInfoCard({ account }: Readonly<{ account: AccountResponse }>): JSX.Element {
  const { t } = useTranslation('finance');
  const dates = useDates();
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-caption text-muted-foreground">
            {account.provider ?? t(`accounts.types.${account.type}`)}
          </span>
          <div className="text-h1">
            <MoneyAmount minor={account.currentBalanceMinor} currency={account.currency} kind="balance" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">{t(`accounts.types.${account.type}`)}</Badge>
          {account.allowOverdraft ? (
            <Badge tone="warning">{t('accounts.allowOverdraft')}</Badge>
          ) : (
            <Badge tone="neutral">{t('accounts.noOverdraft')}</Badge>
          )}
          {account.archivedAt !== null && <Badge tone="danger">{t('accounts.archivedAccounts')}</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 border-t border-border pt-3 text-caption text-muted-foreground sm:grid-cols-4">
        <div>
          <span>{t('accounts.openingBalance')}</span>
          <p className="text-body text-foreground">
            <MoneyAmount minor={account.openingBalanceMinor} currency={account.currency} />
          </p>
        </div>
        <div>
          <span>{t('accounts.openedOn', { date: dates.civil(account.openedOn) })}</span>
        </div>
        {account.allowOverdraft && account.overdraftLimitMinor !== null && (
          <div>
            <span>{t('accounts.overdraftLimit')}</span>
            <p className="text-body text-foreground">
              <MoneyAmount minor={account.overdraftLimitMinor} currency={account.currency} />
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function AccountActionButtons({
  account,
  onAdjust,
  onReconcile,
}: Readonly<{
  account: AccountResponse;
  onAdjust: () => void;
  onReconcile: () => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  const isArchived = account.archivedAt !== null;
  const toggleArchiveMutation = useFinanceMutation(
    () => (isArchived ? financeApi.reopenAccount(account.id) : financeApi.closeAccount(account.id)),
    { successMessage: isArchived ? t('accounts.reopenedSuccess') : t('accounts.closedSuccess') },
  );

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={onAdjust}>
        {t('accounts.adjust')}
      </Button>
      <Button variant="secondary" onClick={onReconcile}>
        {t('accounts.reconcile')}
      </Button>
      <ConfirmButton
        label={isArchived ? t('accounts.reopen') : t('accounts.close')}
        message={isArchived ? t('accounts.reopenConfirm') : t('accounts.closeConfirm')}
        onConfirm={() => {
          void toggleArchiveMutation.mutateAsync();
        }}
      />
    </div>
  );
}

function AccountTransactionsList({
  transactions,
}: Readonly<{ transactions: readonly TransactionResponse[] }>): JSX.Element {
  const { t } = useTranslation('finance');
  const dates = useDates();
  if (transactions.length === 0) {
    return <EmptyState title={t('accounts.entries')} body={t('accounts.noEntries')} />;
  }
  return (
    <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
      {transactions.map((tx) => (
        <li key={tx.id} className="flex items-center justify-between p-3 hover:bg-surface-elevated">
          <div className="flex flex-col">
            <Link to={`/finance/transactions/${tx.id}`} className="text-body font-medium hover:underline">
              {tx.description ?? t(`transactions.types.${tx.type}`)}
            </Link>
            <div className="flex items-center gap-2 text-caption text-muted-foreground">
              <span>{dates.civil(tx.valueDate)}</span>
              <Badge
                tone={tx.status === 'VALIDATED' ? 'neutral' : tx.status === 'PENDING' ? 'warning' : 'danger'}
              >
                {t(`transactions.statuses.${tx.status}`)}
              </Badge>
            </div>
          </div>
          <MoneyAmount
            minor={tx.amountMinor}
            currency={tx.currency}
            kind={tx.type === 'INCOME' ? 'in' : tx.type === 'EXPENSE' ? 'out' : 'neutral'}
            className="text-body-strong"
          />
        </li>
      ))}
    </ul>
  );
}

export function AccountDetailPage(): JSX.Element {
  const { id = '' } = useParams();
  const { t } = useTranslation('finance');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);

  const accountQuery = useFinanceAccount(id);
  const transactionsQuery = useFinanceTransactions({ accountId: id });

  if (accountQuery.isPending) return <LoadingState />;
  if (accountQuery.isError) {
    return <ErrorState error={accountQuery.error} />;
  }

  const account = accountQuery.data.data;
  const transactions = transactionsQuery.data?.data ?? [];

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={account.name}>
        <AccountActionButtons
          account={account}
          onAdjust={() => {
            setAdjustOpen(true);
          }}
          onReconcile={() => {
            setReconcileOpen(true);
          }}
        />
      </PageHeader>
      <AccountInfoCard account={account} />
      <div className="flex flex-col gap-3">
        <h2 className="text-h3">{t('accounts.entries')}</h2>
        <AccountTransactionsList transactions={transactions} />
      </div>
      <AdjustBalanceDialog open={adjustOpen} onOpenChange={setAdjustOpen} account={account} />
      <ReconcileDialog open={reconcileOpen} onOpenChange={setReconcileOpen} account={account} />
    </section>
  );
}
