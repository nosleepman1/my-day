import { AlertTriangle } from 'lucide-react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import type { ForecastAccountPoint, ForecastAccountSummary } from '@orbit/contracts';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { Card } from '@/components/ui/card';

import { useDates } from './common';

function ForecastAccountHeader({ account }: Readonly<{ account: ForecastAccountSummary }>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-caption text-muted-foreground">{t('forecast.currentBalance')}</span>
        <MoneyAmount
          minor={account.currentBalanceMinor}
          currency={account.currency}
          className="text-h3 font-semibold"
        />
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-caption text-muted-foreground">{t('forecast.lowestBalance')}</span>
        <MoneyAmount
          minor={account.lowestProjectedBalanceMinor}
          currency={account.currency}
          kind={BigInt(account.lowestProjectedBalanceMinor) < 0n ? 'out' : 'neutral'}
          className="text-h3 font-semibold"
        />
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-caption text-muted-foreground">{t('forecast.projectedEndBalance')}</span>
        <MoneyAmount
          minor={account.projectedEndBalanceMinor}
          currency={account.currency}
          kind={BigInt(account.projectedEndBalanceMinor) < 0n ? 'out' : 'neutral'}
          className="text-h3 font-semibold"
        />
      </div>
    </div>
  );
}

function ForecastPointRow({
  pt,
  currency,
}: Readonly<{ pt: ForecastAccountPoint; currency: string }>): JSX.Element {
  const dates = useDates();
  const isNegative = BigInt(pt.projectedBalanceMinor) < 0n;

  return (
    <tr className="border-b border-border/50 hover:bg-surface-elevated">
      <td className="p-2.5 font-medium">{dates.civil(pt.date)}</td>
      <td className="p-2.5 text-right">
        {BigInt(pt.expectedInflowsMinor) > 0n ? (
          <MoneyAmount minor={pt.expectedInflowsMinor} currency={currency} kind="in" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="p-2.5 text-right">
        {BigInt(pt.expectedOutflowsMinor) > 0n ? (
          <MoneyAmount minor={pt.expectedOutflowsMinor} currency={currency} kind="out" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="p-2.5 text-right">
        <MoneyAmount
          minor={pt.projectedBalanceMinor}
          currency={currency}
          kind={isNegative ? 'out' : 'neutral'}
          className={isNegative ? 'font-bold text-danger' : 'font-semibold'}
        />
      </td>
    </tr>
  );
}

function ForecastPointsTable({
  points,
  currency,
}: Readonly<{ points: ForecastAccountPoint[]; currency: string }>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-body border-collapse">
        <thead>
          <tr className="border-b border-border bg-surface-muted/50 text-caption text-muted-foreground">
            <th className="p-2.5">{t('forecast.tableDate')}</th>
            <th className="p-2.5 text-right">{t('forecast.tableInflows')}</th>
            <th className="p-2.5 text-right">{t('forecast.tableOutflows')}</th>
            <th className="p-2.5 text-right">{t('forecast.tableBalance')}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((pt) => (
            <ForecastPointRow key={pt.date} pt={pt} currency={currency} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ForecastAccountCard({ account }: Readonly<{ account: ForecastAccountSummary }>): JSX.Element {
  const { t } = useTranslation('finance');
  const dates = useDates();

  const firstNegative = account.hasProjectedNegative
    ? account.points.find((p) => BigInt(p.projectedBalanceMinor) < 0n)
    : undefined;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <h2 className="text-h3 font-bold">
          {account.accountName} ({account.currency})
        </h2>
      </div>

      {firstNegative && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-md border border-danger/40 bg-danger/10 p-3 text-danger"
        >
          <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
          <span className="text-body font-medium">
            {t('forecast.negativeAlert', {
              date: dates.civil(firstNegative.date),
              amount: firstNegative.projectedBalanceMinor,
              currency: account.currency,
            })}
          </span>
        </div>
      )}

      <ForecastAccountHeader account={account} />

      <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
        <h3 className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
          {t('forecast.curveTitle')}
        </h3>
        <ForecastPointsTable points={account.points} currency={account.currency} />
      </div>
    </Card>
  );
}
