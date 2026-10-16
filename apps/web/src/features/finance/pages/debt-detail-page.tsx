import { ArrowLeft, Ban, DollarSign } from 'lucide-react';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import type { DebtResponse, RepaymentResponse } from '@orbit/contracts';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/misc';

import { financeApi } from '../api/finance.api';
import { useFinanceDebt, useFinanceDebtRepayments, useFinanceMutation } from '../api/hooks';
import { CancelDebtDialog } from '../components/cancel-debt-dialog';
import { ConfirmButton, useDates } from '../components/common';
import { RepaymentDialog } from '../components/repayment-dialog';
import { WriteOffDebtDialog } from '../components/write-off-debt-dialog';

function calculateProgressPercent(repaidMinor: string, principalMinor: string): string {
  try {
    const repaid = BigInt(repaidMinor);
    const principal = BigInt(principalMinor);
    if (principal <= 0n) return '0';
    const pct = (repaid * 100n) / principal;
    const bounded = pct < 0n ? 0n : pct > 100n ? 100n : pct;
    return bounded.toString();
  } catch {
    return '0';
  }
}

function DebtDetailHeader({ debt }: Readonly<{ debt: DebtResponse }>): JSX.Element {
  const { t } = useTranslation('finance');
  const isSettled = debt.settlementStatus === 'SETTLED';

  return (
    <header className="flex flex-col gap-3">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/finance/debts">
          <ArrowLeft aria-hidden="true" className="mr-1 size-4" />
          {t('debts.backToList')}
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 font-bold">{debt.title}</h1>
          {debt.counterparty && (
            <span className="text-body text-muted-foreground">
              {t('debts.counterparty')} :{' '}
              <span className="text-foreground font-medium">{debt.counterparty.name}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={debt.type === 'RECEIVABLE' ? 'success' : 'neutral'}>
            {t(`debts.types.${debt.type}`)}
          </Badge>

          {debt.status === 'OPEN' ? (
            <Badge
              tone={
                isSettled ? 'success' : debt.settlementStatus === 'PARTIALLY_SETTLED' ? 'warning' : 'neutral'
              }
            >
              {t(`debts.settlement.${debt.settlementStatus}`)}
            </Badge>
          ) : (
            <Badge tone={debt.status === 'WRITTEN_OFF' ? 'danger' : 'neutral'}>
              {t(`debts.statuses.${debt.status}`)}
            </Badge>
          )}

          {debt.isOverdue && <Badge tone="danger">{t('debts.overdueBadge')}</Badge>}
        </div>
      </div>
    </header>
  );
}

function DebtFinancialCards({ debt }: Readonly<{ debt: DebtResponse }>): JSX.Element {
  const { t } = useTranslation('finance');
  const progressPercent = calculateProgressPercent(debt.totalRepaidMinor, debt.principalMinor);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="text-caption text-muted-foreground">{t('debts.principal')}</span>
          <MoneyAmount minor={debt.principalMinor} currency={debt.currency} className="text-h2 font-bold" />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-caption text-muted-foreground">{t('debts.repaid')}</span>
          <MoneyAmount
            minor={debt.totalRepaidMinor}
            currency={debt.currency}
            kind="in"
            className="text-h2 font-bold"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-caption text-muted-foreground">{t('debts.remaining')}</span>
          <MoneyAmount
            minor={debt.remainingMinor}
            currency={debt.currency}
            kind={debt.type === 'RECEIVABLE' ? 'in' : 'out'}
            className="text-h2 font-bold"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
        <div className="flex items-center justify-between text-caption text-muted-foreground">
          <span>{t('debts.progress')}</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
    </Card>
  );
}

function DebtInfoCard({ debt }: Readonly<{ debt: DebtResponse }>): JSX.Element {
  const { t } = useTranslation('finance');
  const dates = useDates();

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <span className="text-caption text-muted-foreground">{t('debts.openedOnLabel')}</span>
          <p className="text-body font-medium">{dates.civil(debt.openedOn)}</p>
        </div>
        <div>
          <span className="text-caption text-muted-foreground">{t('debts.dueDateLabel')}</span>
          <p className="text-body font-medium">
            {debt.dueDate ? dates.civil(debt.dueDate) : t('debts.noDueDate')}
          </p>
        </div>
      </div>

      {debt.description && (
        <div className="pt-2 border-t border-border/50">
          <span className="text-caption text-muted-foreground">{t('debts.description')}</span>
          <p className="text-body mt-0.5">{debt.description}</p>
        </div>
      )}

      {debt.notes && (
        <div className="pt-2 border-t border-border/50">
          <span className="text-caption text-muted-foreground">{t('debts.notes')}</span>
          <p className="text-body mt-0.5">{debt.notes}</p>
        </div>
      )}

      {debt.status !== 'OPEN' && debt.closingReason && (
        <div className="pt-2 border-t border-border/50 bg-surface-muted/30 p-3 rounded-md">
          <span className="text-caption font-semibold text-danger">
            {t('debts.closingReason', {
              status:
                debt.status === 'CANCELLED'
                  ? t('debts.closingStatusCancelled')
                  : t('debts.closingStatusWrittenOff'),
            })}
          </span>
          <p className="text-body text-foreground mt-1">{debt.closingReason}</p>
        </div>
      )}
    </Card>
  );
}

function DebtActionsBar({
  debt,
  onOpenRepay,
  onOpenCancel,
  onOpenWriteOff,
}: Readonly<{
  debt: DebtResponse;
  onOpenRepay: () => void;
  onOpenCancel: () => void;
  onOpenWriteOff: () => void;
}>): JSX.Element | null {
  const { t } = useTranslation('finance');
  if (debt.status !== 'OPEN') return null;

  const isSettled = debt.settlementStatus === 'SETTLED';
  const hasNoRepayments = BigInt(debt.totalRepaidMinor) === 0n;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!isSettled && (
        <Button onClick={onOpenRepay}>
          <DollarSign aria-hidden="true" className="mr-1.5 size-4" />
          {t('debts.actions.repay')}
        </Button>
      )}

      {hasNoRepayments && (
        <Button variant="secondary" onClick={onOpenCancel}>
          <Ban aria-hidden="true" className="mr-1.5 size-4" />
          {t('debts.actions.cancel')}
        </Button>
      )}

      {debt.type === 'RECEIVABLE' && !isSettled && (
        <Button variant="destructive" onClick={onOpenWriteOff}>
          {t('debts.actions.writeOff')}
        </Button>
      )}
    </div>
  );
}

function DebtRepaymentRow({
  rep,
  isOpen,
  onDelete,
  isDeleting,
}: Readonly<{
  rep: RepaymentResponse;
  isOpen: boolean;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}>): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  const dates = useDates();

  return (
    <tr className="border-b border-border/50 hover:bg-surface-elevated">
      <td className="p-3 font-medium">
        {rep.transaction ? dates.civil(rep.transaction.valueDate) : dates.instant(rep.createdAt)}
      </td>
      <td className="p-3">
        <MoneyAmount minor={rep.amountMinor} currency={rep.currency} kind="in" className="font-semibold" />
      </td>
      <td className="p-3">
        {rep.transactionId ? (
          <Link
            to={`/finance/transactions/${rep.transactionId}`}
            className="text-primary hover:underline text-caption font-mono"
          >
            {rep.transactionId.slice(0, 8)}...
          </Link>
        ) : (
          <span className="text-muted-foreground text-caption">—</span>
        )}
      </td>
      <td className="p-3 text-caption text-muted-foreground">{rep.notes ?? '—'}</td>
      {isOpen && (
        <td className="p-3 text-right">
          <ConfirmButton
            label={t('debts.repayments.deleteAction')}
            message={t('debts.repayments.deleteConfirm')}
            onConfirm={() => {
              onDelete(rep.id);
            }}
            disabled={isDeleting}
          />
        </td>
      )}
    </tr>
  );
}

function DebtRepaymentsTable({
  debt,
  repayments,
  onDelete,
  isDeleting,
}: Readonly<{
  debt: DebtResponse;
  repayments: RepaymentResponse[];
  onDelete: (id: string) => void;
  isDeleting: boolean;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  const isOpen = debt.status === 'OPEN';

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-left text-body border-collapse">
        <thead>
          <tr className="border-b border-border bg-surface-muted/50 text-caption text-muted-foreground">
            <th className="p-3">{t('debts.repayments.date')}</th>
            <th className="p-3">{t('debts.repayments.amount')}</th>
            <th className="p-3">{t('debts.repayments.transactionLinked')}</th>
            <th className="p-3">{t('debts.repayments.notes')}</th>
            {isOpen && <th className="p-3 text-right">{t('debts.repayments.actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {repayments.map((rep) => (
            <DebtRepaymentRow
              key={rep.id}
              rep={rep}
              isOpen={isOpen}
              onDelete={onDelete}
              isDeleting={isDeleting}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DebtRepaymentsSection({
  debt,
  repayments,
  onDelete,
  isDeleting,
}: Readonly<{
  debt: DebtResponse;
  repayments: RepaymentResponse[];
  onDelete: (id: string) => void;
  isDeleting: boolean;
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <section aria-label={t('debts.repayments.ariaLabel')} className="flex flex-col gap-3">
      <h2 className="text-h2 font-semibold">{t('debts.repayments.title')}</h2>
      {repayments.length === 0 ? (
        <EmptyState title={t('debts.repayments.empty')} body={t('debts.repayments.emptyNotice')} />
      ) : (
        <DebtRepaymentsTable
          debt={debt}
          repayments={repayments}
          onDelete={onDelete}
          isDeleting={isDeleting}
        />
      )}
    </section>
  );
}

export function DebtDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useTranslation(['finance', 'common']);

  const [repayDialogOpen, setRepayDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [writeOffDialogOpen, setWriteOffDialogOpen] = useState(false);

  const debtQuery = useFinanceDebt(id);
  const repaymentsQuery = useFinanceDebtRepayments(id);

  const deleteRepaymentMutation = useFinanceMutation(
    (repaymentId: string) => financeApi.deleteDebtRepayment(id, repaymentId),
    { successMessage: t('debts.repayments.deleteSuccess') },
  );

  if (debtQuery.isPending) return <LoadingState label={t('common:states.loading')} />;
  if (debtQuery.isError) {
    return <ErrorState error={debtQuery.error} onRetry={() => void debtQuery.refetch()} />;
  }
  const debt = debtQuery.data.data;
  const repayments = repaymentsQuery.data?.data ?? [];

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <DebtDetailHeader debt={debt} />
      <DebtFinancialCards debt={debt} />
      <DebtInfoCard debt={debt} />
      <DebtActionsBar
        debt={debt}
        onOpenRepay={() => {
          setRepayDialogOpen(true);
        }}
        onOpenCancel={() => {
          setCancelDialogOpen(true);
        }}
        onOpenWriteOff={() => {
          setWriteOffDialogOpen(true);
        }}
      />
      <DebtRepaymentsSection
        debt={debt}
        repayments={repayments}
        onDelete={(repId) => void deleteRepaymentMutation.mutateAsync(repId)}
        isDeleting={deleteRepaymentMutation.isPending}
      />
      <RepaymentDialog open={repayDialogOpen} onOpenChange={setRepayDialogOpen} debt={debt} />
      <CancelDebtDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen} debtId={debt.id} />
      <WriteOffDebtDialog open={writeOffDialogOpen} onOpenChange={setWriteOffDialogOpen} debtId={debt.id} />
    </div>
  );
}
