import { Check, X } from 'lucide-react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import type { RecurringOccurrenceResponse } from '@orbit/contracts';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/misc';

import { useDates } from './common';

function OccurrenceBadge({ occurrence }: Readonly<{ occurrence: RecurringOccurrenceResponse }>): JSX.Element {
  const { t } = useTranslation('finance');

  if (occurrence.status === 'CONFIRMED') {
    return <Badge tone="success">{t('upcoming.confirmedBadge')}</Badge>;
  }
  if (occurrence.status === 'SKIPPED') {
    return <Badge tone="neutral">{t('upcoming.skippedBadge')}</Badge>;
  }
  if (occurrence.isOverdue) {
    return <Badge tone="danger">{t('upcoming.overdueBadge')}</Badge>;
  }
  return <Badge tone="warning">{t('upcoming.expectedBadge')}</Badge>;
}

function OccurrenceHeader({
  occurrence,
}: Readonly<{ occurrence: RecurringOccurrenceResponse }>): JSX.Element {
  const dates = useDates();

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-body-strong text-foreground font-semibold truncate">
          {occurrence.recurringTransaction?.name ?? ''}
        </span>
        <span className="text-caption text-muted-foreground">{dates.civil(occurrence.dueOn)}</span>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <MoneyAmount
          minor={occurrence.expectedAmountMinor}
          currency={occurrence.currency}
          kind="neutral"
          className="text-h3 font-semibold"
        />
        <OccurrenceBadge occurrence={occurrence} />
      </div>
    </div>
  );
}

function OccurrenceActions({
  onConfirm,
  onSkip,
}: Readonly<{
  onConfirm: () => void;
  onSkip: () => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
      <Button variant="ghost" size="sm" onClick={onSkip}>
        <X aria-hidden="true" className="mr-1 size-3.5" />
        {t('upcoming.skip')}
      </Button>
      <Button size="sm" onClick={onConfirm}>
        <Check aria-hidden="true" className="mr-1 size-3.5" />
        {t('upcoming.confirm')}
      </Button>
    </div>
  );
}

export function OccurrenceCard({
  occurrence,
  onConfirm,
  onSkip,
}: Readonly<{
  occurrence: RecurringOccurrenceResponse;
  onConfirm: (occurrence: RecurringOccurrenceResponse) => void;
  onSkip: (occurrence: RecurringOccurrenceResponse) => void;
}>): JSX.Element {
  return (
    <li>
      <Card className="flex flex-col gap-3 p-4 transition-colors hover:bg-surface-elevated">
        <OccurrenceHeader occurrence={occurrence} />
        {occurrence.status === 'EXPECTED' && (
          <OccurrenceActions
            onConfirm={() => {
              onConfirm(occurrence);
            }}
            onSkip={() => {
              onSkip(occurrence);
            }}
          />
        )}
      </Card>
    </li>
  );
}
