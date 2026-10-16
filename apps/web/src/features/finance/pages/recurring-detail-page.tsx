import { ArrowLeft, Pause, Play } from 'lucide-react';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import type { RecurringOccurrenceResponse, RecurringTransactionResponse } from '@orbit/contracts';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/misc';

import { financeApi } from '../api/finance.api';
import {
  useFinanceMutation,
  useFinanceRecurringOccurrences,
  useFinanceRecurringTransaction,
} from '../api/hooks';
import { ConfirmOccurrenceDialog } from '../components/confirm-occurrence-dialog';
import { OccurrenceCard } from '../components/occurrence-card';
import { SkipOccurrenceDialog } from '../components/skip-occurrence-dialog';

function RecurringDetailHeader({
  item,
  onPause,
  onResume,
  isPending,
}: Readonly<{
  item: RecurringTransactionResponse;
  onPause: () => void;
  onResume: () => void;
  isPending: boolean;
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <header className="flex flex-col gap-3">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/finance/recurring">
          <ArrowLeft aria-hidden="true" className="mr-1 size-4" />
          {t('recurring.backToList')}
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 font-bold">{item.name}</h1>
          <span className="text-body text-muted-foreground">{item.recurrenceRule}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            tone={item.status === 'ACTIVE' ? 'success' : item.status === 'PAUSED' ? 'warning' : 'neutral'}
          >
            {item.status === 'ACTIVE'
              ? t('recurring.active')
              : item.status === 'PAUSED'
                ? t('recurring.paused')
                : t('recurring.ended')}
          </Badge>

          {item.status === 'ACTIVE' ? (
            <Button variant="secondary" size="sm" onClick={onPause} disabled={isPending}>
              <Pause aria-hidden="true" className="mr-1 size-3.5" />
              {t('recurring.pause')}
            </Button>
          ) : item.status === 'PAUSED' ? (
            <Button variant="secondary" size="sm" onClick={onResume} disabled={isPending}>
              <Play aria-hidden="true" className="mr-1 size-3.5" />
              {t('recurring.resume')}
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function RecurringFinancialSummary({ item }: Readonly<{ item: RecurringTransactionResponse }>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-caption text-muted-foreground">{t('recurringForm.amount')}</span>
        <MoneyAmount
          minor={item.amountMinor}
          currency={item.currency}
          kind={item.type === 'INCOME' ? 'in' : item.type === 'EXPENSE' ? 'out' : 'neutral'}
          className="text-h2 font-bold"
        />
      </div>
    </Card>
  );
}

function RecurringOccurrencesList({
  occurrences,
  onConfirm,
  onSkip,
}: Readonly<{
  occurrences: RecurringOccurrenceResponse[];
  onConfirm: (occ: RecurringOccurrenceResponse) => void;
  onSkip: (occ: RecurringOccurrenceResponse) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <section aria-label={t('recurring.occurrencesTitle')} className="flex flex-col gap-3">
      <h2 className="text-h2 font-semibold">{t('recurring.occurrencesTitle')}</h2>
      {occurrences.length === 0 ? (
        <EmptyState title={t('recurring.occurrencesEmpty')} body="" />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {occurrences.map((occ) => (
            <OccurrenceCard key={occ.id} occurrence={occ} onConfirm={onConfirm} onSkip={onSkip} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RecurringDetailDialogs({
  confirmOcc,
  onCloseConfirm,
  skipOcc,
  onCloseSkip,
}: Readonly<{
  confirmOcc: RecurringOccurrenceResponse | null;
  onCloseConfirm: () => void;
  skipOcc: RecurringOccurrenceResponse | null;
  onCloseSkip: () => void;
}>): JSX.Element {
  return (
    <>
      {confirmOcc && (
        <ConfirmOccurrenceDialog
          open={!!confirmOcc}
          onOpenChange={(open) => {
            if (!open) onCloseConfirm();
          }}
          occurrence={confirmOcc}
        />
      )}
      {skipOcc && (
        <SkipOccurrenceDialog
          open={!!skipOcc}
          onOpenChange={(open) => {
            if (!open) onCloseSkip();
          }}
          occurrence={skipOcc}
        />
      )}
    </>
  );
}

export function RecurringDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useTranslation(['finance', 'common']);

  const [confirmOcc, setConfirmOcc] = useState<RecurringOccurrenceResponse | null>(null);
  const [skipOcc, setSkipOcc] = useState<RecurringOccurrenceResponse | null>(null);

  const recurringQuery = useFinanceRecurringTransaction(id);
  const occurrencesQuery = useFinanceRecurringOccurrences(id);

  const pauseMutation = useFinanceMutation(() => financeApi.pauseRecurring(id), {
    successMessage: t('recurring.pausedSuccess'),
  });

  const resumeMutation = useFinanceMutation(() => financeApi.resumeRecurring(id), {
    successMessage: t('recurring.resumedSuccess'),
  });

  if (recurringQuery.isPending) return <LoadingState label={t('common:states.loading')} />;
  if (recurringQuery.isError) {
    return <ErrorState error={recurringQuery.error} onRetry={() => void recurringQuery.refetch()} />;
  }

  const item = recurringQuery.data.data;
  const occurrences = occurrencesQuery.data?.data ?? [];
  const isPending = pauseMutation.isPending || resumeMutation.isPending;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <RecurringDetailHeader
        item={item}
        onPause={() => void pauseMutation.mutateAsync()}
        onResume={() => void resumeMutation.mutateAsync()}
        isPending={isPending}
      />
      <RecurringFinancialSummary item={item} />
      <RecurringOccurrencesList occurrences={occurrences} onConfirm={setConfirmOcc} onSkip={setSkipOcc} />
      <RecurringDetailDialogs
        confirmOcc={confirmOcc}
        onCloseConfirm={() => {
          setConfirmOcc(null);
        }}
        skipOcc={skipOcc}
        onCloseSkip={() => {
          setSkipOcc(null);
        }}
      />
    </div>
  );
}
