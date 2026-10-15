import { Injectable } from '@nestjs/common';
import type { AccountType, FinancialAccount, Prisma } from '@prisma/client';

import { calculateBalance, type CalculatedBalance, type LedgerEntryItem } from '../domain/balance-calculator';
import { FinanceContext } from '../shared/finance-context';

export interface CreateAccountDbInput {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly type: AccountType;
  readonly provider?: string | null;
  readonly currency: string;
  readonly openingBalanceMinor: bigint;
  readonly openedOn: Date;
  readonly allowOverdraft: boolean;
  readonly overdraftLimitMinor?: bigint | null;
  readonly includeInNetWorth?: boolean;
  readonly color?: string | null;
  readonly icon?: string | null;
  readonly notes?: string | null;
}

export interface ListAccountsFilters {
  readonly type?: AccountType;
  readonly currency?: string;
  readonly archived?: boolean;
}

@Injectable()
export class AccountsRepository {
  constructor(private readonly ctx: FinanceContext) {}

  async create(data: CreateAccountDbInput): Promise<FinancialAccount> {
    return this.ctx.db.financialAccount.create({
      data: {
        id: data.id,
        userId: data.userId,
        name: data.name,
        type: data.type,
        provider: data.provider ?? null,
        currency: data.currency,
        openingBalanceMinor: data.openingBalanceMinor,
        openedOn: data.openedOn,
        allowOverdraft: data.allowOverdraft,
        overdraftLimitMinor: data.overdraftLimitMinor ?? null,
        includeInNetWorth: data.includeInNetWorth ?? true,
        color: data.color ?? null,
        icon: data.icon ?? null,
        notes: data.notes ?? null,
      },
    });
  }

  async findById(userId: string, id: string): Promise<FinancialAccount | null> {
    return this.ctx.db.financialAccount.findFirst({
      where: {
        userId,
        id,
      },
    });
  }

  async findByName(userId: string, name: string): Promise<FinancialAccount | null> {
    return this.ctx.db.financialAccount.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
  }

  async list(userId: string, filters: ListAccountsFilters = {}): Promise<FinancialAccount[]> {
    return this.ctx.db.financialAccount.findMany({
      where: {
        userId,
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.currency ? { currency: filters.currency } : {}),
        ...(filters.archived === true
          ? { archivedAt: { not: null } }
          : filters.archived === false
            ? { archivedAt: null }
            : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async update(
    userId: string,
    id: string,
    data: Prisma.FinancialAccountUpdateInput,
  ): Promise<FinancialAccount> {
    return this.ctx.db.financialAccount.update({
      where: {
        userId_id: { userId, id },
      },
      data,
    });
  }

  async getBalance(userId: string, accountId: string): Promise<CalculatedBalance | null> {
    const account = await this.ctx.db.financialAccount.findFirst({
      where: { userId, id: accountId },
      select: { openingBalanceMinor: true },
    });

    if (!account) {
      return null;
    }

    const entries = await this.ctx.db.ledgerEntry.findMany({
      where: { userId, accountId },
      select: {
        direction: true,
        amountMinor: true,
        transaction: {
          select: { status: true },
        },
      },
    });

    const items: LedgerEntryItem[] = entries.map((e) => ({
      direction: e.direction,
      amountMinor: e.amountMinor,
      status: e.transaction.status,
    }));

    return calculateBalance(account.openingBalanceMinor, items);
  }
}
