import { Pause, Play } from 'lucide-react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { RecurringTransactionResponse } from '@orbit/contracts';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/misc';

import { financeApi } from '../api/finance.api';
import { useFinanceMutation } from '../api/hooks';

import { useDates } from './common';

function RecurringCardHeader({ item }: Readonly<{ item: RecurringTransactionResponse }>): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-1 min-w-0">
        <Link
          to={`/finance/recurring/${item.id}`}
          className="text-body-strong text-foreground hover:underline truncate"
        >
          {item.name}
        </Link>
        <span className="text-caption text-muted-foreground">{item.recurrenceRule}</span>
      </div>
      <MoneyAmount
        minor={item.amountMinor}
        currency={item.currency}
        kind={item.type === 'INCOME' ? 'in' : item.type === 'EXPENSE' ? 'out' : 'neutral'}
        className="text-h3 font-semibold shrink-0"
      />
    </div>
  );
}

function RecurringCardFooter({
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
  const dates = useDates();
  const statusLabel =
    item.status === 'ACTIVE'
      ? t('recurring.active')
      : item.status === 'PAUSED'
        ? t('recurring.paused')
        : t('recurring.ended');

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
      <div className="flex items-center gap-2">
        <Badge tone={item.status === 'ACTIVE' ? 'success' : item.status === 'PAUSED' ? 'warning' : 'neutral'}>
          {statusLabel}
        </Badge>
        <span className="text-caption text-muted-foreground">
          {item.nextOccurrenceAt
            ? t('recurring.nextOccurrence', { date: dates.instant(item.nextOccurrenceAt) })
            : t('recurring.noNextOccurrence')}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {item.status === 'ACTIVE' ? (
          <Button variant="ghost" size="sm" onClick={onPause} disabled={isPending}>
            <Pause aria-hidden="true" className="mr-1 size-3.5" />
            {t('recurring.pause')}
          </Button>
        ) : item.status === 'PAUSED' ? (
          <Button variant="ghost" size="sm" onClick={onResume} disabled={isPending}>
            <Play aria-hidden="true" className="mr-1 size-3.5" />
            {t('recurring.resume')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function RecurringCard({ item }: Readonly<{ item: RecurringTransactionResponse }>): JSX.Element {
  const { t } = useTranslation('finance');

  const pauseMutation = useFinanceMutation(() => financeApi.pauseRecurring(item.id), {
    successMessage: t('recurring.pausedSuccess'),
  });

  const resumeMutation = useFinanceMutation(() => financeApi.resumeRecurring(item.id), {
    successMessage: t('recurring.resumedSuccess'),
  });

  const isPending = pauseMutation.isPending || resumeMutation.isPending;

  return (
    <li>
      <Card className="flex flex-col gap-3 p-4 transition-colors hover:bg-surface-elevated">
        <RecurringCardHeader item={item} />
        <RecurringCardFooter
          item={item}
          onPause={() => void pauseMutation.mutateAsync()}
          onResume={() => void resumeMutation.mutateAsync()}
          isPending={isPending}
        />
      </Card>
    </li>
  );
}
