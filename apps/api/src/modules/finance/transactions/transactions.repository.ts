import { Injectable } from '@nestjs/common';
import type {
  EconomicClass,
  EntryDirection,
  FinancialAccount,
  LedgerEntry,
  Prisma,
  Transaction,
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

import { AccountLockingQueries } from '../../../platform/database/raw/account-locking.queries';
import { DomainError } from '../../../platform/errors/domain-error';
import { decodeCursor, encodeCursor } from '../../../platform/http/cursor';
import { assertCanCancelTransaction } from '../domain/cancellation-rules';
import { FinanceContext } from '../shared/finance-context';

export interface CreateTransactionDbParams {
  readonly id: string;
  readonly userId: string;
  readonly type: TransactionType;
  readonly status: TransactionStatus;
  readonly economicClass: EconomicClass;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly occurredAt: Date;
  readonly valueDate: Date;
  readonly description?: string | null;
  readonly notes?: string | null;
  readonly categoryId?: string | null;
  readonly counterpartyId?: string | null;
  readonly source?: TransactionSource;
  readonly idempotencyKey?: string | null;
  readonly ledgerEntries: readonly {
    readonly id: string;
    readonly accountId: string;
    readonly direction: EntryDirection;
    readonly amountMinor: bigint;
    readonly currency: string;
  }[];
}

export interface ListTransactionsFilters {
  readonly limit: number;
  readonly cursor?: string;
  readonly accountId?: string;
  readonly categoryId?: string;
  readonly counterpartyId?: string;
  readonly type?: TransactionType;
  readonly status?: TransactionStatus;
  readonly fromDate?: string;
  readonly toDate?: string;
  readonly search?: string;
}

export interface TransactionWithEntries extends Transaction {
  ledgerEntries: LedgerEntry[];
}

@Injectable()
export class TransactionsRepository {
  constructor(
    private readonly ctx: FinanceContext,
    private readonly accountLocking: AccountLockingQueries,
  ) {}

  private validateAccountsAndEntries(
    params: CreateTransactionDbParams,
    accountMap: Map<string, FinancialAccount>,
  ): void {
    for (const entry of params.ledgerEntries) {
      const account = accountMap.get(entry.accountId);
      if (!account) {
        throw new DomainError('NOT_FOUND', 'Compte financier introuvable.');
      }

      if (account.archivedAt !== null) {
        throw new DomainError('BUSINESS_RULE_VIOLATION', 'Opération impossible sur un compte archivé.', {
          accountId: account.id,
        });
      }

      if (params.valueDate < account.openedOn) {
        throw new DomainError(
          'BUSINESS_RULE_VIOLATION',
          "La date de valeur ne peut pas être antérieure à la date d'ouverture du compte.",
          {
            valueDate: params.valueDate.toISOString().slice(0, 10),
            openedOn: account.openedOn.toISOString().slice(0, 10),
          },
        );
      }

      if (account.currency !== entry.currency) {
        throw new DomainError(
          'CURRENCY_MISMATCH',
          `La devise de la transaction (${entry.currency}) ne correspond pas à celle du compte (${account.currency}).`,
          {
            transactionCurrency: entry.currency,
            accountCurrency: account.currency,
          },
        );
      }
    }
  }

  private async assertOverdraftForEntry(
    tx: Prisma.TransactionClient,
    userId: string,
    account: FinancialAccount,
    entryAmountMinor: bigint,
  ): Promise<void> {
    const existingEntries = await tx.ledgerEntry.findMany({
      where: {
        userId,
        accountId: account.id,
        transaction: { status: 'VALIDATED' },
      },
      select: { direction: true, amountMinor: true },
    });

    let currentRealised = account.openingBalanceMinor;
    for (const existing of existingEntries) {
      currentRealised += existing.direction === 'CREDIT' ? existing.amountMinor : -existing.amountMinor;
    }

    const limit = account.allowOverdraft ? (account.overdraftLimitMinor ?? 0n) : 0n;
    const newRealised = currentRealised - entryAmountMinor;

    if (newRealised < -limit) {
      const available = currentRealised + limit;
      throw new DomainError('INSUFFICIENT_FUNDS', 'Solde insuffisant pour exécuter cette opération.', {
        available: available.toString(),
        required: entryAmountMinor.toString(),
      });
    }
  }

  private async checkOverdraftLimits(
    tx: Prisma.TransactionClient,
    userId: string,
    params: CreateTransactionDbParams,
    accountMap: Map<string, FinancialAccount>,
  ): Promise<void> {
    if (params.status !== 'VALIDATED') return;
    for (const entry of params.ledgerEntries) {
      if (entry.direction === 'DEBIT') {
        const account = accountMap.get(entry.accountId);
        if (!account) {
          throw new DomainError('NOT_FOUND', 'Compte financier introuvable.');
        }
        await this.assertOverdraftForEntry(tx, userId, account, entry.amountMinor);
      }
    }
  }

  private async insertEntries(
    tx: Prisma.TransactionClient,
    params: CreateTransactionDbParams,
  ): Promise<LedgerEntry[]> {
    const entries: LedgerEntry[] = [];
    for (const entry of params.ledgerEntries) {
      const le = await tx.ledgerEntry.create({
        data: {
          id: entry.id,
          userId: params.userId,
          transactionId: params.id,
          accountId: entry.accountId,
          direction: entry.direction,
          amountMinor: entry.amountMinor,
          currency: entry.currency,
        },
      });
      entries.push(le);
    }
    return entries;
  }

  private async insertRecords(
    tx: Prisma.TransactionClient,
    params: CreateTransactionDbParams,
  ): Promise<TransactionWithEntries> {
    const isDirectlyValidated = params.status === 'VALIDATED';
    const transaction = await tx.transaction.create({
      data: {
        id: params.id,
        userId: params.userId,
        type: params.type,
        status: 'PENDING',
        economicClass: params.economicClass,
        amountMinor: params.amountMinor,
        currency: params.currency,
        occurredAt: params.occurredAt,
        valueDate: params.valueDate,
        description: params.description ?? null,
        notes: params.notes ?? null,
        categoryId: params.categoryId ?? null,
        counterpartyId: params.counterpartyId ?? null,
        source: params.source ?? 'MANUAL',
        idempotencyKey: params.idempotencyKey ?? null,
        validatedAt: null,
      },
    });

    const entries = await this.insertEntries(tx, params);

    if (isDirectlyValidated) {
      const updated = await tx.transaction.update({
        where: { userId_id: { userId: params.userId, id: params.id } },
        data: {
          status: 'VALIDATED',
          validatedAt: params.occurredAt,
        },
      });
      return { ...updated, ledgerEntries: entries };
    }

    return { ...transaction, ledgerEntries: entries };
  }

  async create(params: CreateTransactionDbParams): Promise<TransactionWithEntries> {
    return this.ctx.db.$transaction(async (tx) => {
      const accountIds = Array.from(new Set(params.ledgerEntries.map((e) => e.accountId)));
      const txClient = tx as unknown as Prisma.TransactionClient;
      await this.accountLocking.lockAccounts(txClient, params.userId, accountIds);

      const accounts = await tx.financialAccount.findMany({
        where: {
          userId: params.userId,
          id: { in: accountIds },
        },
      });

      if (accounts.length !== accountIds.length) {
        throw new DomainError('NOT_FOUND', 'Compte financier introuvable.');
      }

      const accountMap = new Map(accounts.map((a) => [a.id, a]));
      this.validateAccountsAndEntries(params, accountMap);
      await this.checkOverdraftLimits(txClient, params.userId, params, accountMap);

      return this.insertRecords(txClient, params);
    });
  }

  async findById(userId: string, id: string): Promise<TransactionWithEntries | null> {
    return this.ctx.db.transaction.findFirst({
      where: { userId, id },
      include: { ledgerEntries: true },
    });
  }

  async list(
    userId: string,
    filters: ListTransactionsFilters,
  ): Promise<{ rows: TransactionWithEntries[]; hasMore: boolean; nextCursor: string | null }> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(filters.accountId ? { ledgerEntries: { some: { accountId: filters.accountId } } } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.counterpartyId ? { counterpartyId: filters.counterpartyId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.fromDate ? { valueDate: { gte: new Date(filters.fromDate) } } : {}),
      ...(filters.toDate ? { valueDate: { lte: new Date(filters.toDate) } } : {}),
      ...(filters.search ? { description: { contains: filters.search.trim(), mode: 'insensitive' } } : {}),
    };

    const cursorFilter = this.buildCursorWhere(filters.cursor);
    const combinedWhere: Prisma.TransactionWhereInput = cursorFilter ? { AND: [where, cursorFilter] } : where;

    const items = await this.ctx.db.transaction.findMany({
      where: combinedWhere,
      orderBy: [{ valueDate: 'desc' }, { id: 'desc' }],
      take: filters.limit + 1,
      include: { ledgerEntries: true },
    });

    const hasMore = items.length > filters.limit;
    const pageRows = items.slice(0, filters.limit);
    const last = pageRows.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeCursor(['valueDate', last.valueDate.toISOString().slice(0, 10), last.id])
        : null;

    return { rows: pageRows, hasMore, nextCursor };
  }

  private buildCursorWhere(cursor?: string): Prisma.TransactionWhereInput | null {
    if (!cursor) return null;
    const parts = decodeCursor(cursor, 3);
    if (parts[0] !== 'valueDate') {
      throw new DomainError('INVALID_CURSOR', 'Curseur invalide.');
    }
    const [, cursorDateStr = '', cursorId = ''] = parts;
    const cursorDate = new Date(cursorDateStr);
    return {
      OR: [{ valueDate: { lt: cursorDate } }, { AND: [{ valueDate: cursorDate }, { id: { lt: cursorId } }] }],
    };
  }

  async updateDetails(
    userId: string,
    id: string,
    data: {
      description?: string | null;
      notes?: string | null;
      categoryId?: string | null;
      counterpartyId?: string | null;
      valueDate?: Date;
    },
  ): Promise<TransactionWithEntries> {
    const existing = await this.findById(userId, id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Transaction introuvable.');
    }
    if (existing.status === 'CANCELLED') {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Une transaction annulée ne peut plus être modifiée.');
    }

    return this.ctx.db.transaction.update({
      where: { userId_id: { userId, id } },
      data: {
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.counterpartyId !== undefined ? { counterpartyId: data.counterpartyId } : {}),
        ...(data.valueDate !== undefined ? { valueDate: data.valueDate } : {}),
      },
      include: { ledgerEntries: true },
    });
  }

  private async checkOverdraftOnValidate(
    txClient: Prisma.TransactionClient,
    userId: string,
    txRecord: TransactionWithEntries,
    accountMap: Map<string, FinancialAccount>,
  ): Promise<void> {
    for (const entry of txRecord.ledgerEntries) {
      if (entry.direction === 'DEBIT') {
        const account = accountMap.get(entry.accountId);
        if (!account) {
          throw new DomainError('NOT_FOUND', 'Compte financier introuvable.');
        }
        await this.assertOverdraftForEntry(txClient, userId, account, entry.amountMinor);
      }
    }
  }

  async validate(userId: string, id: string): Promise<TransactionWithEntries> {
    return this.ctx.db.$transaction(async (tx) => {
      const txRecord = await tx.transaction.findFirst({
        where: { userId, id },
        include: { ledgerEntries: true },
      });

      if (!txRecord) {
        throw new DomainError('NOT_FOUND', 'Transaction introuvable.');
      }

      if (txRecord.status === 'VALIDATED') {
        throw new DomainError('INVALID_STATE_TRANSITION', 'La transaction est déjà validée.');
      }

      if (txRecord.status === 'CANCELLED') {
        throw new DomainError(
          'INVALID_STATE_TRANSITION',
          'Une transaction annulée ne peut pas être validée.',
        );
      }

      const accountIds = Array.from(new Set(txRecord.ledgerEntries.map((e) => e.accountId)));
      const txClient = tx as unknown as Prisma.TransactionClient;
      await this.accountLocking.lockAccounts(txClient, userId, accountIds);

      const accounts = await tx.financialAccount.findMany({
        where: { userId, id: { in: accountIds } },
      });
      const accountMap = new Map(accounts.map((a) => [a.id, a]));

      await this.checkOverdraftOnValidate(txClient, userId, txRecord, accountMap);

      return tx.transaction.update({
        where: { userId_id: { userId, id } },
        data: {
          status: 'VALIDATED',
          validatedAt: this.ctx.now(),
        },
        include: { ledgerEntries: true },
      });
    });
  }

  private async checkOverdraftOnCancel(
    txClient: Prisma.TransactionClient,
    userId: string,
    records: readonly TransactionWithEntries[],
    accountMap: Map<string, FinancialAccount>,
  ): Promise<void> {
    for (const record of records) {
      for (const entry of record.ledgerEntries) {
        if (entry.direction === 'CREDIT') {
          const account = accountMap.get(entry.accountId);
          if (!account) {
            throw new DomainError('NOT_FOUND', 'Compte financier introuvable.');
          }
          await this.assertOverdraftForEntry(txClient, userId, account, entry.amountMinor);
        }
      }
    }
  }

  private async updateCancelledRecords(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
    reason: string,
  ): Promise<TransactionWithEntries> {
    const cancelledAt = this.ctx.now();
    await tx.transaction.updateMany({
      where: { userId, parentTransactionId: id },
      data: { status: 'CANCELLED', cancelReason: reason, cancelledAt },
    });
    return tx.transaction.update({
      where: { userId_id: { userId, id } },
      data: { status: 'CANCELLED', cancelReason: reason, cancelledAt },
      include: { ledgerEntries: true },
    });
  }

  async cancel(userId: string, id: string, reason: string): Promise<TransactionWithEntries> {
    return this.ctx.db.$transaction(async (tx) => {
      const txRecord = await tx.transaction.findFirst({
        where: { userId, id },
        include: { ledgerEntries: true },
      });

      if (!txRecord) {
        throw new DomainError('NOT_FOUND', 'Transaction introuvable.');
      }

      assertCanCancelTransaction({
        currentStatus: txRecord.status,
        cancelReason: reason,
        isChildTransaction: !!txRecord.parentTransactionId,
      });

      const children = (await tx.transaction.findMany({
        where: { userId, parentTransactionId: id },
        include: { ledgerEntries: true },
      })) as TransactionWithEntries[];

      if (txRecord.status === 'VALIDATED') {
        const allEntries = [...txRecord.ledgerEntries, ...children.flatMap((c) => c.ledgerEntries)];
        const accountIds = Array.from(new Set(allEntries.map((e) => e.accountId)));
        if (accountIds.length > 0) {
          const txClient = tx as unknown as Prisma.TransactionClient;
          await this.accountLocking.lockAccounts(txClient, userId, accountIds);

          const accounts = await tx.financialAccount.findMany({
            where: { userId, id: { in: accountIds } },
          });
          const accountMap = new Map(accounts.map((a) => [a.id, a]));
          await this.checkOverdraftOnCancel(txClient, userId, [txRecord, ...children], accountMap);
        }
      }

      return this.updateCancelledRecords(tx as unknown as Prisma.TransactionClient, userId, id, reason);
    });
  }
}
