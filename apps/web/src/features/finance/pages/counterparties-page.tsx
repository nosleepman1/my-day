import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import type { CounterpartyResponse } from '@orbit/contracts';

import { EmptyState, ErrorState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';

import { useFinanceCounterparties } from '../api/hooks';
import { PageHeader } from '../components/common';
import { CreateCounterpartyDialog } from '../components/create-counterparty-dialog';

function CounterpartyItem({
  counterparty,
}: Readonly<{
  counterparty: CounterpartyResponse;
}>): JSX.Element {
  const { t } = useTranslation('finance');
  return (
    <li className="flex items-center justify-between p-3 hover:bg-surface-elevated">
      <div className="flex flex-col">
        <span className="text-body font-medium">{counterparty.name}</span>
        {counterparty.notes && (
          <span className="text-caption text-muted-foreground">{counterparty.notes}</span>
        )}
      </div>
      <Badge tone="neutral">
        {counterparty.kind === 'PERSON' ? t('counterparties.person') : t('counterparties.organization')}
      </Badge>
    </li>
  );
}

function CounterpartyList({
  counterparties,
}: Readonly<{
  counterparties: readonly CounterpartyResponse[];
}>): JSX.Element {
  const { t } = useTranslation('finance');
  const active = counterparties.filter((cp) => cp.archivedAt === null);

  if (active.length === 0) {
    return <EmptyState title={t('counterparties.title')} body={t('transactions.emptyBody')} />;
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
      {active.map((cp) => (
        <CounterpartyItem key={cp.id} counterparty={cp} />
      ))}
    </ul>
  );
}

export function CounterpartiesPage(): JSX.Element {
  const { t } = useTranslation('finance');
  const [createOpen, setCreateOpen] = useState(false);
  const counterpartiesQuery = useFinanceCounterparties();

  if (counterpartiesQuery.isPending) {
    return <LoadingState />;
  }
  if (counterpartiesQuery.isError) {
    return <ErrorState error={counterpartiesQuery.error} />;
  }

  const counterparties = counterpartiesQuery.data.data;

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('counterparties.title')}>
        <Button
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          {t('counterparties.new')}
        </Button>
      </PageHeader>
      <CounterpartyList counterparties={counterparties} />
      <CreateCounterpartyDialog open={createOpen} onOpenChange={setCreateOpen} />
    </section>
  );
}
