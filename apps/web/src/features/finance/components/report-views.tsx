import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  BalancesReport,
  CategoryBreakdownItem,
  CategoryKind,
  FinanceSummaryReport,
} from '@orbit/contracts';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/misc';

import { useFinanceCashFlowReport, useFinanceCategoryBreakdownReport } from '../api/hooks';

export function SummaryView({ report }: Readonly<{ report: FinanceSummaryReport }>): JSX.Element {
  const { t } = useTranslation('finance');
  if (report.summaries.length === 0) {
    return <EmptyState title={t('reports.summary')} body={t('reports.noData')} />;
  }
  return (
    <div className="flex flex-col gap-4">
      {report.summaries.map((s) => (
        <Card key={s.currency} className="flex flex-col gap-3 p-4">
          <h3 className="text-h4">{s.currency}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col">
              <span className="text-caption text-muted-foreground">{t('reports.income')}</span>
              <MoneyAmount
                minor={s.incomeMinor}
                currency={s.currency}
                kind="in"
                className="text-body-strong"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-caption text-muted-foreground">{t('reports.expense')}</span>
              <MoneyAmount
                minor={s.expenseMinor}
                currency={s.currency}
                kind="out"
                className="text-body-strong"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-caption text-muted-foreground">{t('reports.net')}</span>
              <MoneyAmount
                minor={s.netMinor}
                currency={s.currency}
                kind="balance"
                className="text-body-strong"
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function CategoryBreakdownList({
  categories,
  currency,
  kind,
}: Readonly<{
  categories: readonly CategoryBreakdownItem[];
  currency: string;
  kind: CategoryKind;
}>): JSX.Element {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
      {categories.map((cat) => (
        <li key={cat.categoryId ?? 'none'} className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <span className="text-body font-medium">{cat.categoryName}</span>
            <Badge tone="neutral">{`${cat.percentage}%`}</Badge>
          </div>
          <MoneyAmount minor={cat.amountMinor} currency={currency} kind={kind === 'EXPENSE' ? 'out' : 'in'} />
        </li>
      ))}
    </ul>
  );
}

export function CategoryBreakdownView({ currency }: Readonly<{ currency: string }>): JSX.Element {
  const { t } = useTranslation('finance');
  const [kind, setKind] = useState<CategoryKind>('EXPENSE');
  const query = useFinanceCategoryBreakdownReport({ currency: currency as never, kind });

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} />;

  const data = query.data.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          variant={kind === 'EXPENSE' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            setKind('EXPENSE');
          }}
        >
          {t('categories.expense')}
        </Button>
        <Button
          variant={kind === 'INCOME' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            setKind('INCOME');
          }}
        >
          {t('categories.income')}
        </Button>
      </div>
      {data.categories.length === 0 ? (
        <EmptyState title={t('reports.byCategory')} body={t('reports.noData')} />
      ) : (
        <CategoryBreakdownList categories={data.categories} currency={currency} kind={kind} />
      )}
    </div>
  );
}

export function BalancesView({ report }: Readonly<{ report: BalancesReport }>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        {Object.entries(report.totalsByCurrency).map(([curr, total]) => (
          <Card key={curr} className="flex flex-col p-4">
            <span className="text-caption text-muted-foreground">{curr}</span>
            <MoneyAmount minor={total} currency={curr} kind="balance" className="text-h3" />
          </Card>
        ))}
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
        {report.accounts.map((acc) => (
          <li key={acc.accountId} className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <span className="text-body font-medium">{acc.name}</span>
              <Badge tone="neutral">{t(`accounts.types.${acc.type}`)}</Badge>
            </div>
            <MoneyAmount minor={acc.balanceMinor} currency={acc.currency} kind="balance" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CashFlowView({ currency }: Readonly<{ currency: string }>): JSX.Element {
  const { t } = useTranslation('finance');
  const query = useFinanceCashFlowReport({ currency: currency as never });

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} />;

  const data = query.data.data;
  return (
    <div className="flex flex-col gap-4">
      {data.byMonth.length === 0 ? (
        <EmptyState title={t('reports.cashflow')} body={t('reports.noData')} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
          {data.byMonth.map((m) => (
            <li key={m.month} className="flex items-center justify-between p-3">
              <span className="text-body font-medium">{m.month}</span>
              <div className="flex items-center gap-4 text-small">
                <MoneyAmount minor={m.incomeMinor} currency={currency} kind="in" />
                <MoneyAmount minor={m.expenseMinor} currency={currency} kind="out" />
                <MoneyAmount
                  minor={m.netMinor}
                  currency={currency}
                  kind="balance"
                  className="text-body-strong"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
