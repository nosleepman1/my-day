import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { AccountResponse } from '@orbit/contracts';

import { MoneyAmount } from '@/components/data-display/money-amount';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/misc';

export function AccountCard({ account }: Readonly<{ account: AccountResponse }>): JSX.Element {
  const { t } = useTranslation('finance');

  return (
    <li>
      <Card className="flex flex-col gap-2 p-4 transition-colors hover:bg-surface-elevated">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <Link
              to={`/finance/accounts/${account.id}`}
              className="text-body-strong text-foreground hover:underline"
            >
              {account.name}
            </Link>
            {account.provider !== null && (
              <span className="text-caption text-muted-foreground">{account.provider}</span>
            )}
          </div>
          <MoneyAmount
            minor={account.currentBalanceMinor}
            currency={account.currency}
            kind="balance"
            className="text-h3"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Badge tone="neutral">{t(`accounts.types.${account.type}`)}</Badge>
          {account.allowOverdraft && <Badge tone="warning">{t('accounts.allowOverdraft')}</Badge>}
          {account.archivedAt !== null && <Badge tone="danger">{t('accounts.archivedAccounts')}</Badge>}
        </div>
      </Card>
    </li>
  );
}
