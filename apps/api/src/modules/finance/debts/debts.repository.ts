import { Injectable } from '@nestjs/common';
import type { Debt, DebtStatus, DebtType, Prisma, TransactionStatus } from '@prisma/client';

import { AccountLockingQueries } from '../../../platform/database/raw/account-locking.queries';
import { DomainError } from '../../../platform/errors/domain-error';
import { FinanceContext } from '../shared/finance-context';

export interface DebtRepaymentWithStatus {
  readonly amountMinor: bigint;
  readonly transaction: {
    readonly status: TransactionStatus;
  };
}

export interface DebtWithRelations extends Debt {
  counterparty: {
    id: string;
    name: string;
    kind: string;
  };
  repayments: DebtRepaymentWithStatus[];
}

export interface CreateDebtInitialMovementParam {
  readonly accountId: string;
  readonly valueDate?: Date;
  readonly transactionId: string;
  readonly ledgerEntryId: string;
  readonly occurredAt: Date;
}

export interface CreateDebtDbParams {
  readonly id: string;
  readonly userId: string;
  readonly type: DebtType;
  readonly counterpartyId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly principalMinor: bigint;
  readonly currency: string;
  readonly openedOn: Date;
  readonly dueDate?: Date | null;
  readonly notes?: string | null;
  readonly initialMovement?: CreateDebtInitialMovementParam | null;
}

export interface ListDebtsFilters {
  readonly limit: number;
  readonly cursor?: string;
  readonly type?: DebtType;
  readonly status?: DebtStatus;
  readonly overdue?: boolean;
  readonly counterpartyId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly todayCivil?: string;
}

export interface UpdateDebtDbParams {
  readonly title?: string;
  readonly description?: string | null;
  readonly dueDate?: Date | null;
  readonly notes?: string | null;
}

@Injectable()
export class DebtsRepository {
  constructor(
    private readonly ctx: FinanceContext,
    private readonly accountLocking: AccountLockingQueries,
  ) {}

  private async assertOverdraftForEntry(
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
    const existingEntries = await tx.ledgerEntry.findMany({
      where: {
        userId,
        accountId: account.id,
        transaction: { status: 'VALIDATED' },
      },
      select: { direction: true, amountMinor: true },
    });

    let currentRealised = account.openingBalanceMinor;
    for (const entry of existingEntries) {
      currentRealised += entry.direction === 'CREDIT' ? entry.amountMinor : -entry.amountMinor;
    }

    const limit = account.allowOverdraft ? (account.overdraftLimitMinor ?? 0n) : 0n;
    const newRealised = currentRealised - amountMinor;

    if (newRealised < -limit) {
      throw new DomainError('INSUFFICIENT_FUNDS', 'Solde insuffisant pour exécuter cette opération.');
    }
  }

  private validateInitialAccount(
    account: { archivedAt: Date | null; currency: string; openedOn: Date },
    currency: string,
    valueDate: Date,
  ): void {
    if (account.archivedAt !== null) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Opération impossible sur un compte archivé.');
    }
    if (account.currency !== currency) {
      throw new DomainError(
        'CURRENCY_MISMATCH',
        `La devise de la dette (${currency}) ne correspond pas à celle du compte (${account.currency}).`,
      );
    }
    if (valueDate < account.openedOn) {
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        "La date de valeur ne peut pas être antérieure à la date d'ouverture du compte.",
      );
    }
  }

  private async insertInitialTransaction(
    tx: Prisma.TransactionClient,
    params: CreateDebtDbParams,
    movement: CreateDebtInitialMovementParam,
    valueDate: Date,
  ): Promise<void> {
    const txType = params.type === 'PAYABLE' ? 'BORROWING' : 'LOAN';
    const economicClass = params.type === 'PAYABLE' ? 'DEBT_DRAWDOWN' : 'LOAN_DISBURSEMENT';
    const entryDirection = params.type === 'PAYABLE' ? 'CREDIT' : 'DEBIT';

    await tx.transaction.create({
      data: {
        id: movement.transactionId,
        userId: params.userId,
        type: txType,
        status: 'VALIDATED',
        economicClass,
        amountMinor: params.principalMinor,
        currency: params.currency,
        occurredAt: movement.occurredAt,
        valueDate,
        description: params.title,
        counterpartyId: params.counterpartyId,
        debtId: params.id,
        source: 'MANUAL',
      },
    });

    await tx.ledgerEntry.create({
      data: {
        id: movement.ledgerEntryId,
        userId: params.userId,
        transactionId: movement.transactionId,
        accountId: movement.accountId,
        direction: entryDirection,
        amountMinor: params.principalMinor,
        currency: params.currency,
      },
    });
  }

  private async executeInitialMovement(
    tx: Prisma.TransactionClient,
    params: CreateDebtDbParams,
    movement: CreateDebtInitialMovementParam,
  ): Promise<void> {
    await this.accountLocking.lockAccounts(tx, params.userId, [movement.accountId]);

    const account = await tx.financialAccount.findFirst({
      where: { userId: params.userId, id: movement.accountId },
    });
    if (!account) {
      throw new DomainError('NOT_FOUND', 'Compte financier introuvable.');
    }

    const valueDate = movement.valueDate ?? params.openedOn;
    this.validateInitialAccount(account, params.currency, valueDate);

    if (params.type === 'RECEIVABLE') {
      await this.assertOverdraftForEntry(tx, params.userId, account, params.principalMinor);
    }

    await this.insertInitialTransaction(tx, params, movement, valueDate);
  }

  async create(params: CreateDebtDbParams): Promise<DebtWithRelations> {
    return this.ctx.db.$transaction(async (tx) => {
      const txClient = tx as unknown as Prisma.TransactionClient;
      await tx.debt.create({
        data: {
          id: params.id,
          userId: params.userId,
          type: params.type,
          counterpartyId: params.counterpartyId,
          title: params.title,
          description: params.description,
          principalMinor: params.principalMinor,
          currency: params.currency,
          openedOn: params.openedOn,
          dueDate: params.dueDate,
          status: 'OPEN',
          notes: params.notes,
        },
      });

      if (params.initialMovement) {
        await this.executeInitialMovement(txClient, params, params.initialMovement);
      }

      const created = await tx.debt.findFirst({
        where: { userId: params.userId, id: params.id },
        include: {
          counterparty: { select: { id: true, name: true, kind: true } },
          repayments: {
            select: {
              amountMinor: true,
              transaction: { select: { status: true } },
            },
          },
        },
      });
      if (!created) {
        throw new DomainError('NOT_FOUND', 'Dette introuvable après création.');
      }
      return created;
    });
  }

  async findById(userId: string, id: string): Promise<DebtWithRelations | null> {
    return this.ctx.db.debt.findFirst({
      where: { userId, id },
      include: {
        counterparty: { select: { id: true, name: true, kind: true } },
        repayments: {
          select: {
            amountMinor: true,
            transaction: { select: { status: true } },
          },
        },
      },
    });
  }

  private buildWhereClause(userId: string, filters: ListDebtsFilters): Prisma.DebtWhereInput {
    const where: Prisma.DebtWhereInput = {
      userId,
      ...(filters.type && { type: filters.type }),
      ...(filters.status && { status: filters.status }),
      ...(filters.counterpartyId && { counterpartyId: filters.counterpartyId }),
      ...(filters.from && { openedOn: { gte: new Date(filters.from) } }),
      ...(filters.to && { openedOn: { lte: new Date(filters.to) } }),
    };

    if (filters.overdue && filters.todayCivil) {
      where.status = 'OPEN';
      where.dueDate = { lt: new Date(filters.todayCivil) };
    }

    return where;
  }

  async list(
    userId: string,
    filters: ListDebtsFilters,
  ): Promise<{ items: DebtWithRelations[]; nextCursor?: string }> {
    const where = this.buildWhereClause(userId, filters);

    const rawItems = await this.ctx.db.debt.findMany({
      where,
      take: filters.limit + 1,
      cursor: filters.cursor ? { userId_id: { userId, id: filters.cursor } } : undefined,
      skip: filters.cursor ? 1 : 0,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        counterparty: { select: { id: true, name: true, kind: true } },
        repayments: {
          select: {
            amountMinor: true,
            transaction: { select: { status: true } },
          },
        },
      },
    });

    const hasMore = rawItems.length > filters.limit;
    const items = hasMore ? rawItems.slice(0, filters.limit) : rawItems;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]?.id : undefined;

    return { items, nextCursor };
  }

  async update(userId: string, id: string, data: UpdateDebtDbParams): Promise<DebtWithRelations> {
    return this.ctx.db.debt.update({
      where: { userId_id: { userId, id } },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: {
        counterparty: { select: { id: true, name: true, kind: true } },
        repayments: {
          select: {
            amountMinor: true,
            transaction: { select: { status: true } },
          },
        },
      },
    });
  }
}
