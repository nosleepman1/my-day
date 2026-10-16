import { CalendarClock, LineChart, Plus } from 'lucide-react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { RecurringTransactionResponse } from '@orbit/contracts';

import { EmptyState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';

import { useFinanceRecurringTransactions } from '../api/hooks';
import { PageHeader } from '../components/common';
import { RecurringCard } from '../components/recurring-card';

function RecurringPageHeader(): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <PageHeader title={t('recurring.title')}>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link to="/finance/upcoming">
            <CalendarClock aria-hidden="true" className="mr-1.5 size-4" />
            {t('upcoming.title')}
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link to="/finance/forecast">
            <LineChart aria-hidden="true" className="mr-1.5 size-4" />
            {t('forecast.title')}
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/finance/recurring/new">
            <Plus aria-hidden="true" className="mr-1.5 size-4" />
            {t('recurring.new')}
          </Link>
        </Button>
      </div>
    </PageHeader>
  );
}

function RecurringList({
  items,
  isPending,
}: Readonly<{
  items: RecurringTransactionResponse[];
  isPending: boolean;
}>): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);

  if (isPending) return <LoadingState label={t('common:states.loading')} />;
  if (items.length === 0) {
    return (
      <EmptyState
        title={t('recurring.empty')}
        body={t('recurring.emptyBody')}
        action={
          <Button asChild>
            <Link to="/finance/recurring/new">{t('recurring.new')}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((item) => (
        <RecurringCard key={item.id} item={item} />
      ))}
    </ul>
  );
}

export function RecurringPage(): JSX.Element {
  const recurringQuery = useFinanceRecurringTransactions();
  const items = recurringQuery.data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <RecurringPageHeader />
      <RecurringList items={items} isPending={recurringQuery.isPending} />
    </div>
  );
}
