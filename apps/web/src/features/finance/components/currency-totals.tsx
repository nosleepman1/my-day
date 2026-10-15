import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

type CurrencyTotalsProps = Readonly<{
  totalsByCurrency: Record<string, string>;
}>;

export function CurrencyTotals({ totalsByCurrency }: CurrencyTotalsProps): JSX.Element | null {
  const { t } = useTranslation('finance');
  const entries = Object.entries(totalsByCurrency);
  if (entries.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h3">{t('overview.balancesByCurrency')}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map(([currency, totalMinor]) => (
          <Card key={currency} className="p-4">
            <CardHeader className="p-0">
              <span className="text-caption text-muted-foreground">{currency}</span>
              <CardTitle className="text-h2">
                <MoneyAmount minor={totalMinor} currency={currency} kind="balance" />
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
