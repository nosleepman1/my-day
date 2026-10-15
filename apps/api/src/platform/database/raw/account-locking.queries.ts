import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export type LockedAccountRow = Readonly<{
  id: string;
  user_id: string;
  name: string;
  type: string;
  currency: string;
  opening_balance_minor: bigint;
  allow_overdraft: boolean;
  overdraft_limit_minor: bigint | null;
  archived_at: Date | null;
}>;

/**
 * Verrouillage pessimiste de compte financier (`SELECT ... FOR UPDATE`, ADR-007 point 5, ADR-028, FINANCE_RULES.md §3).
 * SQL brut requis car Prisma ORM ne supporte pas nativement le `SELECT ... FOR UPDATE` sous transaction avec isolation multi-tenant.
 */
@Injectable()
export class AccountLockingQueries {
  async lockAccount(
    tx: Prisma.TransactionClient,
    userId: string,
    accountId: string,
  ): Promise<LockedAccountRow | null> {
    const rows = await tx.$queryRaw<LockedAccountRow[]>`
      SELECT id::text AS id,
             user_id::text AS user_id,
             name,
             type::text AS type,
             currency,
             opening_balance_minor,
             allow_overdraft,
             overdraft_limit_minor,
             archived_at
        FROM financial_accounts
       WHERE user_id = ${userId}::uuid
         AND id = ${accountId}::uuid
         FOR UPDATE`;
    return rows[0] ?? null;
  }

  async lockAccounts(
    tx: Prisma.TransactionClient,
    userId: string,
    accountIds: readonly string[],
  ): Promise<LockedAccountRow[]> {
    if (accountIds.length === 0) return [];
    const sortedIds = [...new Set(accountIds)].sort();
    return tx.$queryRaw<LockedAccountRow[]>`
      SELECT id::text AS id,
             user_id::text AS user_id,
             name,
             type::text AS type,
             currency,
             opening_balance_minor,
             allow_overdraft,
             overdraft_limit_minor,
             archived_at
        FROM financial_accounts
       WHERE user_id = ${userId}::uuid
         AND id = ANY(${sortedIds}::uuid[])
       ORDER BY id
         FOR UPDATE`;
  }
}
