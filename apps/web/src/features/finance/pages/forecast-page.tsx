import { ArrowLeft } from 'lucide-react';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { AccountResponse, ForecastAccountSummary } from '@orbit/contracts';

import { EmptyState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import { useFinanceAccounts, useFinanceForecast } from '../api/hooks';
import { NativeSelect, PageHeader } from '../components/common';
import { ForecastAccountCard } from '../components/forecast-chart';

function parseHorizon(value: string): number {
  if (value === '30') return 30;
  if (value === '60') return 60;
  return 90;
}

function ForecastHorizonSelect({
  horizon,
  onChange,
}: Readonly<{ horizon: number; onChange: (h: number) => void }>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <NativeSelect
      id="forecast-horizon"
      aria-label={t('forecast.horizon')}
      value={String(horizon)}
      onChange={(e) => {
        onChange(parseHorizon(e.target.value));
      }}
      options={[
        { value: '30', label: t('forecast.horizon30') },
        { value: '60', label: t('forecast.horizon60') },
        { value: '90', label: t('forecast.horizon90') },
      ]}
    />
  );
}

function ForecastAccountSelect({
  accountId,
  onChange,
  accounts,
}: Readonly<{
  accountId: string;
  onChange: (id: string) => void;
  accounts: AccountResponse[];
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <NativeSelect
      id="forecast-account"
      aria-label={t('forecast.account')}
      value={accountId}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      options={[
        { value: '', label: t('forecast.allAccounts') },
        ...accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` })),
      ]}
    />
  );
}

function ForecastFiltersBar({
  horizon,
  onHorizonChange,
  accountId,
  onAccountChange,
  includeDebts,
  onIncludeDebtsChange,
  accounts,
}: Readonly<{
  horizon: number;
  onHorizonChange: (h: number) => void;
  accountId: string;
  onAccountChange: (id: string) => void;
  includeDebts: boolean;
  onIncludeDebtsChange: (inc: boolean) => void;
  accounts: AccountResponse[];
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/finance/recurring">
          <ArrowLeft aria-hidden="true" className="mr-1 size-4" />
          {t('recurring.backToList')}
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-3">
        <ForecastHorizonSelect horizon={horizon} onChange={onHorizonChange} />
        <ForecastAccountSelect accountId={accountId} onChange={onAccountChange} accounts={accounts} />

        <div className="flex items-center gap-2">
          <Checkbox
            id="forecast-include-debts"
            checked={includeDebts}
            onCheckedChange={(checked) => {
              onIncludeDebtsChange(checked === true);
            }}
          />
          <Label htmlFor="forecast-include-debts" className="text-body cursor-pointer">
            {t('forecast.includeDebts')}
          </Label>
        </div>
      </div>
    </div>
  );
}

function ForecastAccountsList({
  accounts,
  isPending,
}: Readonly<{
  accounts: ForecastAccountSummary[];
  isPending: boolean;
}>): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);

  if (isPending) return <LoadingState label={t('common:states.loading')} />;
  if (accounts.length === 0) {
    return <EmptyState title={t('forecast.noData')} body="" />;
  }

  return (
    <div className="flex flex-col gap-6">
      {accounts.map((acc) => (
        <ForecastAccountCard key={acc.accountId} account={acc} />
      ))}
    </div>
  );
}

export function ForecastPage(): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  const [horizon, setHorizon] = useState(90);
  const [accountId, setAccountId] = useState('');
  const [includeDebts, setIncludeDebts] = useState(false);

  const accounts = useFinanceAccounts({ archived: false }).data?.data ?? [];
  const forecastQuery = useFinanceForecast({
    horizon,
    accountId: accountId || undefined,
    includeDebts,
  });

  const report = forecastQuery.data?.data;
  const accountsData = report?.accounts ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('forecast.title')} />

      <ForecastFiltersBar
        horizon={horizon}
        onHorizonChange={setHorizon}
        accountId={accountId}
        onAccountChange={setAccountId}
        includeDebts={includeDebts}
        onIncludeDebtsChange={setIncludeDebts}
        accounts={accounts}
      />

      <ForecastAccountsList accounts={accountsData} isPending={forecastQuery.isPending} />
    </div>
  );
}
