import { ArrowLeft } from 'lucide-react';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { OccurrenceStatus, RecurringOccurrenceResponse } from '@orbit/contracts';

import { EmptyState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';

import { useFinanceOccurrences } from '../api/hooks';
import { NativeSelect, PageHeader } from '../components/common';
import { ConfirmOccurrenceDialog } from '../components/confirm-occurrence-dialog';
import { OccurrenceCard } from '../components/occurrence-card';
import { SkipOccurrenceDialog } from '../components/skip-occurrence-dialog';

function UpcomingFilterBar({
  status,
  onChange,
}: Readonly<{
  status: OccurrenceStatus | '';
  onChange: (val: OccurrenceStatus | '') => void;
}>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
      <Button asChild variant="ghost" size="sm">
        <Link to="/finance/recurring">
          <ArrowLeft aria-hidden="true" className="mr-1 size-4" />
          {t('recurring.backToList')}
        </Link>
      </Button>

      <NativeSelect
        id="filter-occ-status"
        aria-label={t('debts.statusLabel')}
        value={status}
        onChange={(e) => {
          onChange(e.target.value as OccurrenceStatus | '');
        }}
        options={[
          { value: '', label: t('debts.filterAllStatuses') },
          { value: 'EXPECTED', label: t('upcoming.expectedBadge') },
          { value: 'CONFIRMED', label: t('upcoming.confirmedBadge') },
          { value: 'SKIPPED', label: t('upcoming.skippedBadge') },
        ]}
      />
    </div>
  );
}

function OccurrencesSectionList({
  title,
  occurrences,
  onConfirm,
  onSkip,
}: Readonly<{
  title: string;
  occurrences: RecurringOccurrenceResponse[];
  onConfirm: (occ: RecurringOccurrenceResponse) => void;
  onSkip: (occ: RecurringOccurrenceResponse) => void;
}>): JSX.Element | null {
  if (occurrences.length === 0) return null;

  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-h3 font-semibold">{title}</h2>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {occurrences.map((occ) => (
          <OccurrenceCard key={occ.id} occurrence={occ} onConfirm={onConfirm} onSkip={onSkip} />
        ))}
      </ul>
    </section>
  );
}

export function UpcomingOccurrencesPage(): JSX.Element {
  const { t } = useTranslation(['finance', 'common']);
  const [status, setStatus] = useState<OccurrenceStatus | ''>('');
  const [confirmOcc, setConfirmOcc] = useState<RecurringOccurrenceResponse | null>(null);
  const [skipOcc, setSkipOcc] = useState<RecurringOccurrenceResponse | null>(null);

  const occurrencesQuery = useFinanceOccurrences(status ? { status } : undefined);
  const occurrences = occurrencesQuery.data?.data ?? [];

  const overdueItems = occurrences.filter((o) => o.isOverdue && o.status === 'EXPECTED');
  const regularItems = occurrences.filter((o) => !o.isOverdue || o.status !== 'EXPECTED');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('upcoming.title')} />

      <UpcomingFilterBar status={status} onChange={setStatus} />

      {occurrencesQuery.isPending ? (
        <LoadingState label={t('common:states.loading')} />
      ) : occurrences.length === 0 ? (
        <EmptyState title={t('upcoming.empty')} body={t('upcoming.emptyBody')} />
      ) : (
        <div className="flex flex-col gap-6">
          <OccurrencesSectionList
            title={t('upcoming.overdueSection')}
            occurrences={overdueItems}
            onConfirm={setConfirmOcc}
            onSkip={setSkipOcc}
          />
          <OccurrencesSectionList
            title={t('upcoming.upcomingSection')}
            occurrences={regularItems}
            onConfirm={setConfirmOcc}
            onSkip={setSkipOcc}
          />
        </div>
      )}

      {confirmOcc && (
        <ConfirmOccurrenceDialog
          open={!!confirmOcc}
          onOpenChange={(open) => {
            if (!open) setConfirmOcc(null);
          }}
          occurrence={confirmOcc}
        />
      )}

      {skipOcc && (
        <SkipOccurrenceDialog
          open={!!skipOcc}
          onOpenChange={(open) => {
            if (!open) setSkipOcc(null);
          }}
          occurrence={skipOcc}
        />
      )}
    </div>
  );
}
