import { Plus } from 'lucide-react';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState, LoadingState } from '@/components/data-display/states';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { useFinanceAccounts } from '../api/hooks';
import { AccountCard } from '../components/account-card';
import { AccountFormDialog } from '../components/account-form-dialog';
import { PageHeader } from '../components/common';

export function AccountsPage(): JSX.Element {
  const { t } = useTranslation('finance');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const accountsQuery = useFinanceAccounts({ archived: showArchived ? undefined : false });

  if (accountsQuery.isPending) {
    return <LoadingState />;
  }

  const accounts = accountsQuery.data?.data ?? [];
  const filtered = showArchived ? accounts : accounts.filter((a) => a.archivedAt === null);

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('accounts.title')}>
        <Button
          onClick={() => {
            setDialogOpen(true);
          }}
        >
          <Plus aria-hidden="true" className="mr-1 size-4" />
          {t('accounts.new')}
        </Button>
      </PageHeader>
      <div className="flex items-center gap-2">
        <Switch id="show-archived-accounts" checked={showArchived} onCheckedChange={setShowArchived} />
        <Label htmlFor="show-archived-accounts">{t('accounts.showArchived')}</Label>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title={t('accounts.empty')} body={t('accounts.emptyBody')} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((acc) => (
            <AccountCard key={acc.id} account={acc} />
          ))}
        </ul>
      )}
      <AccountFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </section>
  );
}
