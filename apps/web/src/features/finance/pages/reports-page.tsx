import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';

import { useFinanceAccounts, useFinanceBalancesReport, useFinanceSummaryReport } from '../api/hooks';
import { PageHeader } from '../components/common';
import { BalancesView, CashFlowView, CategoryBreakdownView, SummaryView } from '../components/report-views';

type ReportTab = 'summary' | 'byCategory' | 'balances' | 'cashflow';

function TabButtons({
  active,
  onChange,
}: Readonly<{
  active: ReportTab;
  onChange: (tab: ReportTab) => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  const tabs: readonly ReportTab[] = ['summary', 'byCategory', 'balances', 'cashflow'];
  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-2">
      {tabs.map((tab) => (
        <Button
          key={tab}
          variant={active === tab ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            onChange(tab);
          }}
        >
          {t(`reports.${tab}`)}
        </Button>
      ))}
    </div>
  );
}

function ReportTabContent({
  active,
  currency,
}: Readonly<{
  active: ReportTab;
  currency: string;
}>): JSX.Element {
  const summaryQuery = useFinanceSummaryReport(undefined, active === 'summary');
  const balancesQuery = useFinanceBalancesReport(undefined, active === 'balances');

  if (active === 'summary') {
    if (summaryQuery.isPending) return <LoadingState />;
    if (summaryQuery.isError) return <ErrorState error={summaryQuery.error} />;
    return <SummaryView report={summaryQuery.data.data} />;
  }
  if (active === 'balances') {
    if (balancesQuery.isPending) return <LoadingState />;
    if (balancesQuery.isError) return <ErrorState error={balancesQuery.error} />;
    return <BalancesView report={balancesQuery.data.data} />;
  }
  if (active === 'byCategory') {
    return <CategoryBreakdownView currency={currency} />;
  }
  return <CashFlowView currency={currency} />;
}

export function ReportsPage(): JSX.Element {
  const { t } = useTranslation('finance');
  const [tab, setTab] = useState<ReportTab>('summary');
  const accountsQuery = useFinanceAccounts();
  const accounts = accountsQuery.data?.data ?? [];
  const currency = accounts[0]?.currency ?? 'XOF';

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('reports.title')} />
      <TabButtons active={tab} onChange={setTab} />
      <ReportTabContent active={tab} currency={currency} />
    </section>
  );
}
