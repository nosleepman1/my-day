import { Injectable } from '@nestjs/common';
import type { Debt, DebtStatus, DebtType, Prisma, TransactionStatus } from '@prisma/client';

import { AccountLockingQueries } from '../../../platform/database/raw/account-locking.queries';
import { DomainError } from '../../../platform/errors/domain-error';
import { computeDebtRemaining } from '../domain/debt-rules';
import { FinanceContext } from '../shared/finance-context';

export interface DebtRepaymentWithStatus {
  readonly amountMinor: bigint;
  readonly transaction: {
    readonly status: TransactionStatus;
  };
}

export interface RepaymentWithTransaction {
  readonly id: string;
  readonly debtId: string;
  readonly transactionId: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly transaction: {
    readonly id: string;
    readonly occurredAt: Date;
    readonly valueDate: Date;
    readonly status: TransactionStatus;
    readonly amountMinor: bigint;
    readonly currency: string;
  };
}

export interface CreateRepaymentWithTxParams {
  readonly id: string;
  readonly userId: string;
  readonly debtId: string;
  readonly accountId: string;
  readonly amountMinor: bigint;
  readonly date?: string;
  readonly notes?: string | null;
  readonly transactionId: string;
  readonly ledgerEntryId: string;
  readonly occurredAt: Date;
}

export interface AttachRepaymentParams {
  readonly id: string;
  readonly userId: string;
  readonly debtId: string;
  readonly transactionId: string;
  readonly amountMinor: bigint;
  readonly notes?: string | null;
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
        status: 'PENDING',
        validatedAt: null,
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

    await tx.transaction.update({
      where: { userId_id: { userId: params.userId, id: movement.transactionId } },
      data: {
        status: 'VALIDATED',
        validatedAt: movement.occurredAt,
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

  private validateDebtForRepayment(debt: DebtWithRelations | null, amountMinor: bigint): DebtWithRelations {
    if (!debt) {
      throw new DomainError('NOT_FOUND', 'Dette introuvable.');
    }
    if (debt.status !== 'OPEN') {
      throw new DomainError('INVALID_STATE_TRANSITION', 'Impossible de rembourser une dette clôturée.');
    }
    const remaining = computeDebtRemaining(debt.principalMinor, debt.repayments);
    if (amountMinor > remaining) {
      throw new DomainError('OVERPAYMENT', 'Le montant du remboursement dépasse le solde restant.');
    }
    return debt;
  }

  private async executeRepaymentAccount(
    tx: Prisma.TransactionClient,
    debt: DebtWithRelations,
    params: CreateRepaymentWithTxParams,
    valueDate: Date,
  ): Promise<void> {
    await this.accountLocking.lockAccounts(tx, params.userId, [params.accountId]);
    const account = await tx.financialAccount.findFirst({
      where: { userId: params.userId, id: params.accountId },
    });
    if (!account) {
      throw new DomainError('NOT_FOUND', 'Compte financier introuvable.');
    }
    this.validateInitialAccount(account, debt.currency, valueDate);

    if (debt.type === 'PAYABLE') {
      await this.assertOverdraftForEntry(tx, params.userId, account, params.amountMinor);
    }

    await this.createValidatedRepaymentTransaction(tx, debt, params, valueDate);
  }

  private async createValidatedRepaymentTransaction(
    tx: Prisma.TransactionClient,
    debt: DebtWithRelations,
    params: CreateRepaymentWithTxParams,
    valueDate: Date,
  ): Promise<void> {
    const isPayable = debt.type === 'PAYABLE';
    await tx.transaction.create({
      data: {
        id: params.transactionId,
        userId: params.userId,
        type: isPayable ? 'EXPENSE' : 'INCOME',
        status: 'PENDING',
        validatedAt: null,
        economicClass: isPayable ? 'DEBT_REPAYMENT' : 'LOAN_COLLECTION',
        amountMinor: params.amountMinor,
        currency: debt.currency,
        occurredAt: params.occurredAt,
        valueDate,
        description: `Remboursement: ${debt.title}`,
        counterpartyId: debt.counterpartyId,
        source: 'MANUAL',
      },
    });

    await tx.ledgerEntry.create({
      data: {
        id: params.ledgerEntryId,
        userId: params.userId,
        transactionId: params.transactionId,
        accountId: params.accountId,
        direction: isPayable ? 'DEBIT' : 'CREDIT',
        amountMinor: params.amountMinor,
        currency: debt.currency,
      },
    });

    await tx.transaction.update({
      where: { userId_id: { userId: params.userId, id: params.transactionId } },
      data: { status: 'VALIDATED', validatedAt: params.occurredAt },
    });
  }

  async createRepaymentWithTransaction(
    params: CreateRepaymentWithTxParams,
  ): Promise<RepaymentWithTransaction> {
    return this.ctx.db.$transaction(async (tx) => {
      const txClient = tx as unknown as Prisma.TransactionClient;
      const debt = await this.findById(params.userId, params.debtId);
      const safeDebt = this.validateDebtForRepayment(debt, params.amountMinor);

      const valueDate = params.date ? new Date(params.date) : params.occurredAt;
      await this.executeRepaymentAccount(txClient, safeDebt, params, valueDate);

      return tx.debtRepayment.create({
        data: {
          id: params.id,
          userId: params.userId,
          debtId: params.debtId,
          transactionId: params.transactionId,
          amountMinor: params.amountMinor,
          currency: safeDebt.currency,
          notes: params.notes ?? null,
        },
        include: {
          transaction: {
            select: {
              id: true,
              occurredAt: true,
              valueDate: true,
              status: true,
              amountMinor: true,
              currency: true,
            },
          },
        },
      });
    });
  }

  private validateExistingTxForRepayment(
    existingTx: { status: string; currency: string; amountMinor: bigint } | null,
    debtCurrency: string,
    amountMinor: bigint,
  ): void {
    if (!existingTx) {
      throw new DomainError('NOT_FOUND', 'Transaction introuvable.');
    }
    if (existingTx.status !== 'VALIDATED') {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Seule une transaction validée peut être rattachée.');
    }
    if (existingTx.currency !== debtCurrency) {
      throw new DomainError('CURRENCY_MISMATCH', 'Devise de la transaction incompatible avec la dette.');
    }
    if (amountMinor > existingTx.amountMinor) {
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        'Le montant imputé dépasse le montant de la transaction.',
      );
    }
  }

  async attachRepayment(params: AttachRepaymentParams): Promise<RepaymentWithTransaction> {
    return this.ctx.db.$transaction(async (tx) => {
      const debt = await this.findById(params.userId, params.debtId);
      const safeDebt = this.validateDebtForRepayment(debt, params.amountMinor);

      const existingTx = await tx.transaction.findFirst({
        where: { userId: params.userId, id: params.transactionId },
      });
      this.validateExistingTxForRepayment(existingTx, safeDebt.currency, params.amountMinor);

      const existingRepayment = await tx.debtRepayment.findFirst({
        where: { userId: params.userId, transactionId: params.transactionId },
      });
      if (existingRepayment) {
        throw new DomainError('CONFLICT', 'Cette transaction est déjà rattachée à un remboursement.');
      }

      const existingOccurrence = await tx.recurringOccurrence.findFirst({
        where: { userId: params.userId, transactionId: params.transactionId },
      });
      if (existingOccurrence) {
        throw new DomainError(
          'CONFLICT',
          'Cette transaction est déjà rattachée à une occurrence récurrente.',
        );
      }

      return tx.debtRepayment.create({
        data: {
          id: params.id,
          userId: params.userId,
          debtId: params.debtId,
          transactionId: params.transactionId,
          amountMinor: params.amountMinor,
          currency: safeDebt.currency,
          notes: params.notes ?? null,
        },
        include: {
          transaction: {
            select: {
              id: true,
              occurredAt: true,
              valueDate: true,
              status: true,
              amountMinor: true,
              currency: true,
            },
          },
        },
      });
    });
  }

  async deleteRepayment(
    userId: string,
    debtId: string,
    repaymentId: string,
  ): Promise<{ id: string; debtId: string; transactionId: string }> {
    const repayment = await this.ctx.db.debtRepayment.findFirst({
      where: { userId, debtId, id: repaymentId },
    });
    if (!repayment) {
      throw new DomainError('NOT_FOUND', 'Remboursement introuvable.');
    }

    await this.ctx.db.debtRepayment.delete({
      where: { userId_id: { userId, id: repaymentId } },
    });

    return { id: repayment.id, debtId: repayment.debtId, transactionId: repayment.transactionId };
  }

  async listRepayments(userId: string, debtId: string): Promise<RepaymentWithTransaction[]> {
    return this.ctx.db.debtRepayment.findMany({
      where: { userId, debtId },
      orderBy: { createdAt: 'desc' },
      include: {
        transaction: {
          select: {
            id: true,
            occurredAt: true,
            valueDate: true,
            status: true,
            amountMinor: true,
            currency: true,
          },
        },
      },
    });
  }

  async cancel(
    userId: string,
    id: string,
    closingReason: string,
    cancelledAt: Date,
  ): Promise<DebtWithRelations> {
    return this.ctx.db.debt.update({
      where: { userId_id: { userId, id } },
      data: {
        status: 'CANCELLED',
        closingReason,
        cancelledAt,
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

  async writeOff(
    userId: string,
    id: string,
    closingReason: string,
    writtenOffAt: Date,
  ): Promise<DebtWithRelations> {
    return this.ctx.db.debt.update({
      where: { userId_id: { userId, id } },
      data: {
        status: 'WRITTEN_OFF',
        closingReason,
        writtenOffAt,
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

  async findOpenDebtsForSummary(userId: string): Promise<DebtWithRelations[]> {
    return this.ctx.db.debt.findMany({
      where: { userId, status: 'OPEN' },
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
