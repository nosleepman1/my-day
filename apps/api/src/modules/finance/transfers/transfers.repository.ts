import { Injectable } from '@nestjs/common';
import { Prisma, type FinancialAccount, type LedgerEntry, type Transaction } from '@prisma/client';

import { AccountLockingQueries } from '../../../platform/database/raw/account-locking.queries';
import { DomainError } from '../../../platform/errors/domain-error';
import { FinanceContext } from '../shared/finance-context';

export interface TransferFeeParam {
  readonly id: string;
  readonly amountMinor: bigint;
  readonly categoryId?: string | null;
}

export interface CreateTransferDbParams {
  readonly id: string;
  readonly userId: string;
  readonly fromAccountId: string;
  readonly toAccountId: string;
  readonly fromAmountMinor: bigint;
  readonly toAmountMinor: bigint;
  readonly fromCurrency: string;
  readonly toCurrency: string;
  readonly exchangeRate?: string | null;
  readonly rateDate?: Date | null;
  readonly occurredAt: Date;
  readonly valueDate: Date;
  readonly description?: string | null;
  readonly notes?: string | null;
  readonly idempotencyKey?: string | null;
  readonly fee?: TransferFeeParam | null;
}

export type TransferWithDetails = Transaction & {
  ledgerEntries: LedgerEntry[];
  feeTransaction?: (Transaction & { ledgerEntries: LedgerEntry[] }) | null;
};

@Injectable()
export class TransfersRepository {
  constructor(
    private readonly ctx: FinanceContext,
    private readonly accountLocking: AccountLockingQueries,
  ) {}

  private validateAccounts(from: FinancialAccount, to: FinancialAccount): void {
    if (from.archivedAt) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Le compte source est archivé.');
    }
    if (to.archivedAt) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Le compte destination est archivé.');
    }
  }

  private async assertOverdraft(
    tx: Prisma.TransactionClient,
    userId: string,
    account: FinancialAccount,
    debitMinor: bigint,
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
    const newRealised = currentRealised - debitMinor;

    if (newRealised < -limit) {
      const available = currentRealised + limit;
      throw new DomainError('INSUFFICIENT_FUNDS', 'Solde insuffisant pour exécuter cette opération.', {
        available: available.toString(),
        required: debitMinor.toString(),
      });
    }
  }

  private async insertEntries(
    tx: Prisma.TransactionClient,
    params: CreateTransferDbParams,
  ): Promise<LedgerEntry[]> {
    const fromEntry = await tx.ledgerEntry.create({
      data: {
        id: this.ctx.newId(),
        userId: params.userId,
        transactionId: params.id,
        accountId: params.fromAccountId,
        direction: 'DEBIT',
        amountMinor: params.fromAmountMinor,
        currency: params.fromCurrency,
      },
    });

    const toEntry = await tx.ledgerEntry.create({
      data: {
        id: this.ctx.newId(),
        userId: params.userId,
        transactionId: params.id,
        accountId: params.toAccountId,
        direction: 'CREDIT',
        amountMinor: params.toAmountMinor,
        currency: params.toCurrency,
      },
    });

    return [fromEntry, toEntry];
  }

  private async insertFee(
    tx: Prisma.TransactionClient,
    params: CreateTransferDbParams,
  ): Promise<(Transaction & { ledgerEntries: LedgerEntry[] }) | null> {
    if (!params.fee) return null;

    const feeTx = await tx.transaction.create({
      data: {
        id: params.fee.id,
        userId: params.userId,
        type: 'EXPENSE',
        status: 'VALIDATED',
        economicClass: 'EXPENSE_FEE',
        amountMinor: params.fee.amountMinor,
        currency: params.fromCurrency,
        occurredAt: params.occurredAt,
        valueDate: params.valueDate,
        description: 'Frais de transfert',
        categoryId: params.fee.categoryId ?? null,
        parentTransactionId: params.id,
        source: 'MANUAL',
        validatedAt: params.occurredAt,
      },
    });

    const feeEntry = await tx.ledgerEntry.create({
      data: {
        id: this.ctx.newId(),
        userId: params.userId,
        transactionId: feeTx.id,
        accountId: params.fromAccountId,
        direction: 'DEBIT',
        amountMinor: params.fee.amountMinor,
        currency: params.fromCurrency,
      },
    });

    return { ...feeTx, ledgerEntries: [feeEntry] };
  }

  async createTransfer(params: CreateTransferDbParams): Promise<TransferWithDetails> {
    return this.ctx.db.$transaction(async (tx) => {
      const accountIds = [params.fromAccountId, params.toAccountId];
      const txClient = tx as unknown as Prisma.TransactionClient;
      await this.accountLocking.lockAccounts(txClient, params.userId, accountIds);

      const accounts = await tx.financialAccount.findMany({
        where: { userId: params.userId, id: { in: accountIds } },
      });

      const fromAccount = accounts.find((a) => a.id === params.fromAccountId);
      const toAccount = accounts.find((a) => a.id === params.toAccountId);
      if (!fromAccount || !toAccount) {
        throw new DomainError('NOT_FOUND', 'Compte financier introuvable.');
      }

      this.validateAccounts(fromAccount, toAccount);
      const totalDebit = params.fromAmountMinor + (params.fee?.amountMinor ?? 0n);
      await this.assertOverdraft(txClient, params.userId, fromAccount, totalDebit);

      const rateVal = params.exchangeRate ? new Prisma.Decimal(params.exchangeRate) : null;
      const transferTx = await tx.transaction.create({
        data: {
          id: params.id,
          userId: params.userId,
          type: 'TRANSFER',
          status: 'VALIDATED',
          economicClass: 'INTERNAL_TRANSFER',
          amountMinor: params.fromAmountMinor,
          currency: params.fromCurrency,
          occurredAt: params.occurredAt,
          valueDate: params.valueDate,
          description: params.description ?? null,
          notes: params.notes ?? null,
          rate: rateVal,
          rateDate: params.rateDate ?? null,
          rateSource: rateVal ? 'MANUAL' : null,
          source: 'MANUAL',
          idempotencyKey: params.idempotencyKey ?? null,
          validatedAt: params.occurredAt,
        },
      });

      const entries = await this.insertEntries(txClient, params);
      const feeTransaction = await this.insertFee(txClient, params);

      return { ...transferTx, ledgerEntries: entries, feeTransaction };
    });
  }

  async findById(userId: string, id: string): Promise<TransferWithDetails | null> {
    const tx = await this.ctx.db.transaction.findFirst({
      where: { userId, id, type: 'TRANSFER' },
      include: {
        ledgerEntries: true,
        feeTransactions: {
          include: { ledgerEntries: true },
        },
      },
    });

    if (!tx) return null;
    const feeTransaction = tx.feeTransactions[0] ?? null;
    return { ...tx, feeTransaction };
  }
}
