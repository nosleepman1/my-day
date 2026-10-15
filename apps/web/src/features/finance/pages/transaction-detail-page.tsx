import { ArrowLeft, Check, XCircle } from 'lucide-react';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import type { LedgerEntryResponse, TransactionResponse } from '@orbit/contracts';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { EmptyState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/misc';

import { financeApi } from '../api/finance.api';
import { useFinanceAccounts, useFinanceMutation, useFinanceTransaction } from '../api/hooks';
import { CancelTransactionDialog } from '../components/cancel-transaction-dialog';
import { useDates } from '../components/common';

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'VALIDATED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'CANCELLED') return 'danger';
  return 'neutral';
}

function LedgerEntriesSection({
  entries,
}: Readonly<{ entries: readonly LedgerEntryResponse[] }>): JSX.Element {
  const { t } = useTranslation('finance');
  const accounts = useFinanceAccounts().data?.data ?? [];
  const accountName = (id: string): string => accounts.find((a) => a.id === id)?.name ?? id;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h3">{t('transactions.ledgerEntries')}</h2>
      {entries.length === 0 ? (
        <p className="text-caption text-muted-foreground">{t('transactions.noEntries')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between rounded-md border border-input-border p-3"
            >
              <div className="flex items-center gap-2">
                <Badge tone={entry.direction === 'CREDIT' ? 'success' : 'danger'}>
                  {entry.direction === 'CREDIT' ? t('transactions.credit') : t('transactions.debit')}
                </Badge>
                <span className="text-body text-foreground">{accountName(entry.accountId)}</span>
              </div>
              <MoneyAmount
                minor={entry.amountMinor}
                currency={entry.currency}
                kind={entry.direction === 'CREDIT' ? 'in' : 'out'}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DetailActions({
  tx,
  onOpenCancel,
}: Readonly<{
  tx: TransactionResponse;
  onOpenCancel: () => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  const validateMutation = useFinanceMutation(() => financeApi.validateTransaction(tx.id), {
    successMessage: t('transactions.validateSuccess'),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tx.status === 'PENDING' && (
        <Button
          variant="primary"
          disabled={validateMutation.isPending}
          onClick={() => {
            void validateMutation.mutateAsync();
          }}
        >
          <Check aria-hidden="true" className="mr-1 size-4" />
          {t('transactions.validate')}
        </Button>
      )}
      {tx.status !== 'CANCELLED' && (
        <Button variant="destructive" onClick={onOpenCancel}>
          <XCircle aria-hidden="true" className="mr-1 size-4" />
          {t('transactions.cancel')}
        </Button>
      )}
    </div>
  );
}

function DetailHeader({
  tx,
  onOpenCancel,
}: Readonly<{
  tx: TransactionResponse;
  onOpenCancel: () => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  const dates = useDates();

  return (
    <header className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/finance/transactions">
          <ArrowLeft aria-hidden="true" className="mr-1 size-4" />
          {t('transactions.backToList')}
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1">{tx.description ?? t(`transactions.types.${tx.type}`)}</h1>
          <span className="text-caption text-muted-foreground">{dates.civil(tx.valueDate)}</span>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge tone="neutral">{t(`transactions.types.${tx.type}`)}</Badge>
            <Badge tone={statusTone(tx.status)}>{t(`transactions.statuses.${tx.status}`)}</Badge>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <MoneyAmount
            minor={tx.amountMinor}
            currency={tx.currency}
            kind={tx.type === 'EXPENSE' ? 'out' : tx.type === 'INCOME' ? 'in' : 'neutral'}
            className="text-h2"
          />
          <DetailActions tx={tx} onOpenCancel={onOpenCancel} />
        </div>
      </div>
    </header>
  );
}

export function TransactionDetailPage(): JSX.Element {
  const { t } = useTranslation('finance');
  const dates = useDates();
  const { id = '' } = useParams<{ id: string }>();
  const [cancelOpen, setCancelOpen] = useState(false);
  const { data, isLoading } = useFinanceTransaction(id);
  const tx = data?.data;

  if (isLoading)
    return (
      <main className="p-6">
        <LoadingState />
      </main>
    );
  if (!tx)
    return (
      <main className="p-6">
        <EmptyState title={t('transactions.empty')} />
      </main>
    );

  return (
    <main className="flex flex-col gap-6 p-4 sm:p-6">
      <DetailHeader
        tx={tx}
        onOpenCancel={() => {
          setCancelOpen(true);
        }}
      />
      {tx.status === 'CANCELLED' && (
        <Card className="border-danger bg-danger-surface p-4 text-danger">
          <p className="text-body-strong">{t('transactions.cancelledBanner')}</p>
          {tx.cancelReason !== null && <p className="text-body pt-1">{tx.cancelReason}</p>}
          {tx.cancelledAt !== null && <p className="text-caption pt-1">{dates.instant(tx.cancelledAt)}</p>}
        </Card>
      )}
      {tx.notes !== null && (
        <Card className="flex flex-col gap-1 p-4">
          <h2 className="text-body-strong">{t('accountForm.notes')}</h2>
          <p className="text-body text-muted-foreground">{tx.notes}</p>
        </Card>
      )}
      <LedgerEntriesSection entries={tx.ledgerEntries} />
      <CancelTransactionDialog open={cancelOpen} onOpenChange={setCancelOpen} transactionId={tx.id} />
    </main>
  );
}
