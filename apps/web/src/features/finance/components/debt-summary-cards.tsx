import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import type { DebtSummaryByCurrency, DebtSummaryResponse } from '@orbit/contracts';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { Card } from '@/components/ui/card';

function DebtCurrencyCard({ summary }: Readonly<{ summary: DebtSummaryByCurrency }>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <span className="text-body-strong text-foreground font-semibold">
          {t('debts.summary.currency', { currency: summary.currency })}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-caption text-muted-foreground">{t('debts.summary.totalPayable')}</span>
          <MoneyAmount
            minor={summary.remainingPayableMinor}
            currency={summary.currency}
            kind="out"
            className="text-h3 font-semibold"
          />
          {BigInt(summary.overduePayableMinor) > 0n && (
            <span className="text-caption text-danger">
              {t('debts.summary.overdue')}
              <MoneyAmount minor={summary.overduePayableMinor} currency={summary.currency} />
            </span>
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-caption text-muted-foreground">{t('debts.summary.totalReceivable')}</span>
          <MoneyAmount
            minor={summary.remainingReceivableMinor}
            currency={summary.currency}
            kind="in"
            className="text-h3 font-semibold"
          />
          {BigInt(summary.overdueReceivableMinor) > 0n && (
            <span className="text-caption text-danger">
              {t('debts.summary.overdue')}
              <MoneyAmount minor={summary.overdueReceivableMinor} currency={summary.currency} />
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

export function DebtSummaryCards({
  summary,
}: Readonly<{ summary?: DebtSummaryResponse | undefined }>): JSX.Element | null {
  const { t } = useTranslation('finance');

  if (!summary || summary.currencies.length === 0) return null;

  return (
    <section aria-label={t('debts.summary.ariaLabel')} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {summary.currencies.map((curr) => (
          <DebtCurrencyCard key={curr.currency} summary={curr} />
        ))}
      </div>
    </section>
  );
}
