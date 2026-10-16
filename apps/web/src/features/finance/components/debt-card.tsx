import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { DebtResponse } from '@orbit/contracts';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/misc';

import { useDates } from './common';

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

function DebtCardHeader({ debt }: Readonly<{ debt: DebtResponse }>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-1 min-w-0">
        <Link
          to={`/finance/debts/${debt.id}`}
          className="text-body-strong text-foreground hover:underline truncate"
        >
          {debt.title}
        </Link>
        {debt.counterparty && (
          <span className="text-caption text-muted-foreground">{debt.counterparty.name}</span>
        )}
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="text-caption text-muted-foreground">{t('debts.remaining')}</span>
        <MoneyAmount
          minor={debt.remainingMinor}
          currency={debt.currency}
          kind={debt.type === 'RECEIVABLE' ? 'in' : 'out'}
          className="text-h3 font-semibold"
        />
      </div>
    </div>
  );
}

function DebtCardProgress({
  debt,
  progressPercent,
}: Readonly<{ debt: DebtResponse; progressPercent: string }>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-caption text-muted-foreground">
        <span>
          {t('debts.repaid')} :{' '}
          <MoneyAmount minor={debt.totalRepaidMinor} currency={debt.currency} className="font-medium" /> /{' '}
          <MoneyAmount minor={debt.principalMinor} currency={debt.currency} className="font-medium" />
        </span>
        <span>{progressPercent}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
        <div className="h-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );
}

function DebtCardBadges({ debt }: Readonly<{ debt: DebtResponse }>): JSX.Element {
  const { t } = useTranslation('finance');
  const dates = useDates();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={debt.type === 'RECEIVABLE' ? 'success' : 'neutral'}>
          {t(`debts.types.${debt.type}`)}
        </Badge>

        {debt.status === 'OPEN' ? (
          <Badge
            tone={
              debt.settlementStatus === 'SETTLED'
                ? 'success'
                : debt.settlementStatus === 'PARTIALLY_SETTLED'
                  ? 'warning'
                  : 'neutral'
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

      <span className="text-caption text-muted-foreground">
        {debt.dueDate ? t('debts.dueDate', { date: dates.civil(debt.dueDate) }) : t('debts.noDueDate')}
      </span>
    </div>
  );
}

export function DebtCard({ debt }: Readonly<{ debt: DebtResponse }>): JSX.Element {
  const progressPercent = calculateProgressPercent(debt.totalRepaidMinor, debt.principalMinor);

  return (
    <li>
      <Card className="flex flex-col gap-3 p-4 transition-colors hover:bg-surface-elevated">
        <DebtCardHeader debt={debt} />
        <DebtCardProgress debt={debt} progressPercent={progressPercent} />
        <DebtCardBadges debt={debt} />
      </Card>
    </li>
  );
}
