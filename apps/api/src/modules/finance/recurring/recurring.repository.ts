import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type {
  EconomicClass,
  RecurringGenerationMode,
  RecurringStatus,
  TransactionType,
} from '@orbit/contracts';

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

@Injectable()
export class RecurringRepository {
  constructor(private readonly ctx: FinanceContext) {}

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
}
