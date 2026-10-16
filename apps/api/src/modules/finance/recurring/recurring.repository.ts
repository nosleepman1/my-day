import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type {
  EconomicClass,
  OccurrenceStatus,
  RecurringGenerationMode,
  RecurringStatus,
  TransactionType,
} from '@orbit/contracts';

import { AccountLockingQueries } from '../../../platform/database/raw/account-locking.queries';
import { DomainError } from '../../../platform/errors/domain-error';
import { FinanceContext } from '../shared/finance-context';

export interface RecurringTransactionWithRelations {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly type: TransactionType;
  readonly economicClass: EconomicClass;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly accountId: string;
  readonly destinationAccountId: string | null;
  readonly categoryId: string | null;
  readonly counterpartyId: string | null;
  readonly projectId: string | null;
  readonly generationMode: RecurringGenerationMode;
  readonly reminderDaysBefore: number;
  readonly status: RecurringStatus;
  readonly recurrenceRule: string;
  readonly recurrenceAnchorOn: Date;
  readonly recurrenceTimezone: string;
  readonly recurrenceLocalTime: Date | null;
  readonly nextOccurrenceAt: Date | null;
  readonly generatedUntil: Date | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly account?: { readonly id: string; readonly name: string; readonly currency: string };
  readonly destinationAccount?: {
    readonly id: string;
    readonly name: string;
    readonly currency: string;
  } | null;
  readonly category?: { readonly id: string; readonly name: string } | null;
  readonly counterparty?: { readonly id: string; readonly name: string; readonly kind: string } | null;
}

export interface OccurrenceWithRelations {
  readonly id: string;
  readonly userId: string;
  readonly recurringTransactionId: string;
  readonly dueOn: Date;
  readonly expectedAmountMinor: bigint;
  readonly currency: string;
  readonly status: OccurrenceStatus;
  readonly transactionId: string | null;
  readonly confirmedAt: Date | null;
  readonly skippedAt: Date | null;
  readonly createdAt: Date;
  readonly recurringTransaction?: {
    readonly id: string;
    readonly name: string;
    readonly type: TransactionType;
    readonly economicClass: EconomicClass;
    readonly accountId: string;
    readonly destinationAccountId?: string | null;
    readonly categoryId?: string | null;
    readonly counterpartyId?: string | null;
    readonly projectId?: string | null;
  };
}

export interface CreateOccurrenceDbParams {
  readonly id: string;
  readonly userId: string;
  readonly recurringTransactionId: string;
  readonly dueOn: Date;
  readonly expectedAmountMinor: bigint;
  readonly currency: string;
  readonly status: OccurrenceStatus;
}

export interface ListOccurrencesFilters {
  readonly from?: string;
  readonly to?: string;
  readonly status?: OccurrenceStatus;
  readonly recurringTransactionId?: string;
  readonly accountId?: string;
  readonly limit: number;
  readonly cursor?: string;
}

export interface ConfirmWithNewTxParams {
  readonly userId: string;
  readonly occurrenceId: string;
  readonly transactionId: string;
  readonly ledgerEntryId: string;
  readonly destinationLedgerEntryId?: string | null;
  readonly accountId: string;
  readonly destinationAccountId?: string | null;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly type: TransactionType;
  readonly economicClass: EconomicClass;
  readonly valueDate: Date;
  readonly description: string;
  readonly categoryId?: string | null;
  readonly counterpartyId?: string | null;
  readonly projectId?: string | null;
  readonly confirmedAt: Date;
}

export interface CreateRecurringDbParams {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly type: TransactionType;
  readonly economicClass: EconomicClass;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly accountId: string;
  readonly destinationAccountId?: string | null;
  readonly categoryId?: string | null;
  readonly counterpartyId?: string | null;
  readonly projectId?: string | null;
  readonly generationMode: RecurringGenerationMode;
  readonly reminderDaysBefore: number;
  readonly recurrenceRule: string;
  readonly recurrenceAnchorOn: Date;
  readonly recurrenceTimezone: string;
  readonly recurrenceLocalTime?: Date | null;
  readonly nextOccurrenceAt?: Date | null;
  readonly notes?: string | null;
}

export interface UpdateRecurringDbParams {
  readonly name?: string;
  readonly amountMinor?: bigint;
  readonly accountId?: string;
  readonly destinationAccountId?: string | null;
  readonly categoryId?: string | null;
  readonly counterpartyId?: string | null;
  readonly projectId?: string | null;
  readonly generationMode?: RecurringGenerationMode;
  readonly reminderDaysBefore?: number;
  readonly recurrenceRule?: string;
  readonly recurrenceTimezone?: string;
  readonly recurrenceLocalTime?: Date | null;
  readonly nextOccurrenceAt?: Date | null;
  readonly notes?: string | null;
}

export interface ListRecurringFilters {
  readonly status?: RecurringStatus;
  readonly type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  readonly accountId?: string;
  readonly limit: number;
  readonly cursor?: string;
}

const RELATION_INCLUDES = {
  account: { select: { id: true, name: true, currency: true } },
  destinationAccount: { select: { id: true, name: true, currency: true } },
  category: { select: { id: true, name: true } },
  counterparty: { select: { id: true, name: true, kind: true } },
} as const;

const OCCURRENCE_INCLUDES = {
  recurringTransaction: {
    select: {
      id: true,
      name: true,
      type: true,
      economicClass: true,
      accountId: true,
      destinationAccountId: true,
      categoryId: true,
      counterpartyId: true,
      projectId: true,
    },
  },
} as const;

@Injectable()
export class RecurringRepository {
  constructor(
    private readonly ctx: FinanceContext,
    private readonly accountLocking: AccountLockingQueries,
  ) {}

  async create(params: CreateRecurringDbParams): Promise<RecurringTransactionWithRelations> {
    return this.ctx.db.recurringTransaction.create({
      data: {
        id: params.id,
        userId: params.userId,
        name: params.name,
        type: params.type,
        economicClass: params.economicClass,
        amountMinor: params.amountMinor,
        currency: params.currency,
        accountId: params.accountId,
        destinationAccountId: params.destinationAccountId ?? null,
        categoryId: params.categoryId ?? null,
        counterpartyId: params.counterpartyId ?? null,
        projectId: params.projectId ?? null,
        generationMode: params.generationMode,
        reminderDaysBefore: params.reminderDaysBefore,
        status: 'ACTIVE',
        recurrenceRule: params.recurrenceRule,
        recurrenceAnchorOn: params.recurrenceAnchorOn,
        recurrenceTimezone: params.recurrenceTimezone,
        recurrenceLocalTime: params.recurrenceLocalTime ?? null,
        nextOccurrenceAt: params.nextOccurrenceAt ?? null,
        notes: params.notes ?? null,
      },
      include: RELATION_INCLUDES,
    });
  }

  async findById(userId: string, id: string): Promise<RecurringTransactionWithRelations | null> {
    return this.ctx.db.recurringTransaction.findFirst({
      where: { userId, id },
      include: RELATION_INCLUDES,
    });
  }

  private buildWhereClause(
    userId: string,
    filters: ListRecurringFilters,
  ): Prisma.RecurringTransactionWhereInput {
    const where: Prisma.RecurringTransactionWhereInput = { userId };
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.accountId) where.accountId = filters.accountId;
    return where;
  }

  async list(
    userId: string,
    filters: ListRecurringFilters,
  ): Promise<{ items: RecurringTransactionWithRelations[]; nextCursor?: string }> {
    const where = this.buildWhereClause(userId, filters);

    const rawItems = await this.ctx.db.recurringTransaction.findMany({
      where,
      take: filters.limit + 1,
      cursor: filters.cursor ? { userId_id: { userId, id: filters.cursor } } : undefined,
      skip: filters.cursor ? 1 : 0,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: RELATION_INCLUDES,
    });

    const hasMore = rawItems.length > filters.limit;
    const items = hasMore ? rawItems.slice(0, filters.limit) : rawItems;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]?.id : undefined;

    return { items, nextCursor };
  }

  private sanitizeUpdateData(data: UpdateRecurringDbParams): Prisma.RecurringTransactionUpdateInput {
    const updateInput: Prisma.RecurringTransactionUpdateInput = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        (updateInput as Record<string, unknown>)[key] = value;
      }
    }
    return updateInput;
  }

  async update(
    userId: string,
    id: string,
    data: UpdateRecurringDbParams,
  ): Promise<RecurringTransactionWithRelations> {
    return this.ctx.db.recurringTransaction.update({
      where: { userId_id: { userId, id } },
      data: this.sanitizeUpdateData(data),
      include: RELATION_INCLUDES,
    });
  }

  async updateStatus(
    userId: string,
    id: string,
    status: RecurringStatus,
    nextOccurrenceAt: Date | null,
  ): Promise<RecurringTransactionWithRelations> {
    return this.ctx.db.recurringTransaction.update({
      where: { userId_id: { userId, id } },
      data: {
        status,
        nextOccurrenceAt,
      },
      include: RELATION_INCLUDES,
    });
  }

  async createOccurrencesBatch(items: CreateOccurrenceDbParams[]): Promise<number> {
    if (items.length === 0) return 0;
    const result = await this.ctx.db.recurringOccurrence.createMany({
      data: items,
      skipDuplicates: true,
    });
    return result.count;
  }

  async findOccurrenceById(userId: string, id: string): Promise<OccurrenceWithRelations | null> {
    return this.ctx.db.recurringOccurrence.findFirst({
      where: { userId, id },
      include: OCCURRENCE_INCLUDES,
    });
  }

  private buildOccurrencesWhere(
    userId: string,
    filters: ListOccurrencesFilters,
  ): Prisma.RecurringOccurrenceWhereInput {
    const where: Prisma.RecurringOccurrenceWhereInput = { userId };
    if (filters.status) where.status = filters.status;
    if (filters.recurringTransactionId) where.recurringTransactionId = filters.recurringTransactionId;
    if (filters.accountId) {
      where.recurringTransaction = { accountId: filters.accountId };
    }
    if (filters.from || filters.to) {
      const dueOnFilter: Prisma.DateTimeFilter = {};
      if (filters.from) {
        dueOnFilter.gte = new Date(`${filters.from}T00:00:00.000Z`);
      }
      if (filters.to) {
        dueOnFilter.lte = new Date(`${filters.to}T00:00:00.000Z`);
      }
      where.dueOn = dueOnFilter;
    }
    return where;
  }

  async listOccurrences(
    userId: string,
    filters: ListOccurrencesFilters,
  ): Promise<{ items: OccurrenceWithRelations[]; nextCursor?: string }> {
    const where = this.buildOccurrencesWhere(userId, filters);

    const rawItems = await this.ctx.db.recurringOccurrence.findMany({
      where,
      take: filters.limit + 1,
      cursor: filters.cursor ? { userId_id: { userId, id: filters.cursor } } : undefined,
      skip: filters.cursor ? 1 : 0,
      orderBy: [{ dueOn: 'asc' }, { id: 'asc' }],
      include: OCCURRENCE_INCLUDES,
    });

    const hasMore = rawItems.length > filters.limit;
    const items = hasMore ? rawItems.slice(0, filters.limit) : rawItems;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]?.id : undefined;

    return { items, nextCursor };
  }

  async attachOccurrenceTransaction(
    userId: string,
    id: string,
    transactionId: string,
    confirmedAt: Date,
  ): Promise<OccurrenceWithRelations> {
    return this.ctx.db.recurringOccurrence.update({
      where: { userId_id: { userId, id } },
      data: {
        status: 'CONFIRMED',
        transactionId,
        confirmedAt,
      },
      include: OCCURRENCE_INCLUDES,
    });
  }

  async skipOccurrence(userId: string, id: string, skippedAt: Date): Promise<OccurrenceWithRelations> {
    return this.ctx.db.recurringOccurrence.update({
      where: { userId_id: { userId, id } },
      data: {
        status: 'SKIPPED',
        skippedAt,
      },
      include: OCCURRENCE_INCLUDES,
    });
  }

  private async assertOverdraft(
    tx: Prisma.TransactionClient,
    userId: string,
    account: {
      id: string;
      openingBalanceMinor: bigint;
      allowOverdraft: boolean;
      overdraftLimitMinor: bigint | null;
    },
    amountMinor: bigint,
  ): Promise<void> {
    const entries = await tx.ledgerEntry.findMany({
      where: { userId, accountId: account.id, transaction: { status: 'VALIDATED' } },
      select: { direction: true, amountMinor: true },
    });

    let currentRealised = account.openingBalanceMinor;
    for (const entry of entries) {
      currentRealised += entry.direction === 'CREDIT' ? entry.amountMinor : -entry.amountMinor;
    }

    const limit = account.allowOverdraft ? (account.overdraftLimitMinor ?? 0n) : 0n;
    if (currentRealised - amountMinor < -limit) {
      throw new DomainError('INSUFFICIENT_FUNDS', 'Solde insuffisant pour exécuter cette opération.');
    }
  }

  private async validateAccountForTx(
    tx: Prisma.TransactionClient,
    userId: string,
    accountId: string,
    currency: string,
  ) {
    const account = await tx.financialAccount.findFirst({
      where: { userId, id: accountId },
    });
    if (!account) {
      throw new DomainError('NOT_FOUND', 'Compte financier introuvable.');
    }
    if (account.archivedAt !== null) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Opération impossible sur un compte archivé.');
    }
    if (account.currency !== currency) {
      throw new DomainError('CURRENCY_MISMATCH', 'Devise incompatible avec le compte.');
    }
    return account;
  }

  private async insertOccurrenceLedgerEntries(
    tx: Prisma.TransactionClient,
    params: ConfirmWithNewTxParams,
  ): Promise<void> {
    const isDebit = params.type === 'EXPENSE' || params.type === 'TRANSFER';
    await tx.ledgerEntry.create({
      data: {
        id: params.ledgerEntryId,
        userId: params.userId,
        transactionId: params.transactionId,
        accountId: params.accountId,
        direction: isDebit ? 'DEBIT' : 'CREDIT',
        amountMinor: params.amountMinor,
        currency: params.currency,
      },
    });

    if (params.type === 'TRANSFER' && params.destinationAccountId && params.destinationLedgerEntryId) {
      await tx.ledgerEntry.create({
        data: {
          id: params.destinationLedgerEntryId,
          userId: params.userId,
          transactionId: params.transactionId,
          accountId: params.destinationAccountId,
          direction: 'CREDIT',
          amountMinor: params.amountMinor,
          currency: params.currency,
        },
      });
    }
  }

  private async validateAccountsAndOverdraft(
    txClient: Prisma.TransactionClient,
    params: ConfirmWithNewTxParams,
  ): Promise<void> {
    const lockIds = [params.accountId];
    if (params.type === 'TRANSFER' && params.destinationAccountId) {
      lockIds.push(params.destinationAccountId);
    }
    await this.accountLocking.lockAccounts(txClient, params.userId, lockIds);
    const origin = await this.validateAccountForTx(
      txClient,
      params.userId,
      params.accountId,
      params.currency,
    );
    if (params.type === 'EXPENSE' || params.type === 'TRANSFER') {
      await this.assertOverdraft(txClient, params.userId, origin, params.amountMinor);
    }
    if (params.type === 'TRANSFER' && params.destinationAccountId) {
      await this.validateAccountForTx(txClient, params.userId, params.destinationAccountId, params.currency);
    }
  }

  private async createOccurrenceTransaction(
    tx: Prisma.TransactionClient,
    params: ConfirmWithNewTxParams,
  ): Promise<void> {
    await tx.transaction.create({
      data: {
        id: params.transactionId,
        userId: params.userId,
        type: params.type,
        status: 'VALIDATED',
        economicClass: params.economicClass,
        amountMinor: params.amountMinor,
        currency: params.currency,
        occurredAt: params.confirmedAt,
        valueDate: params.valueDate,
        description: params.description,
        categoryId: params.categoryId ?? null,
        counterpartyId: params.counterpartyId ?? null,
        projectId: params.projectId ?? null,
        source: 'RECURRENCE',
      },
    });
  }

  async confirmOccurrenceWithTransaction(params: ConfirmWithNewTxParams): Promise<OccurrenceWithRelations> {
    return this.ctx.db.$transaction(async (tx) => {
      const txClient = tx as unknown as Prisma.TransactionClient;
      await this.validateAccountsAndOverdraft(txClient, params);
      await this.createOccurrenceTransaction(txClient, params);
      await this.insertOccurrenceLedgerEntries(txClient, params);

      return tx.recurringOccurrence.update({
        where: { userId_id: { userId: params.userId, id: params.occurrenceId } },
        data: {
          status: 'CONFIRMED',
          transactionId: params.transactionId,
          confirmedAt: params.confirmedAt,
        },
        include: OCCURRENCE_INCLUDES,
      });
    });
  }
}
