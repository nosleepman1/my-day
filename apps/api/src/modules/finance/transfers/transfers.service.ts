import { Injectable } from '@nestjs/common';
import type { FinancialAccount } from '@prisma/client';

import type { CreateTransfer, CreateTransferInput, CurrencyCode, TransferResponse } from '@orbit/contracts';
import { CreateTransferSchema } from '@orbit/contracts';

import { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import { assertDestinationAmountMatches, convertCurrency } from '../domain/fx-converter';
import { FinanceContext } from '../shared/finance-context';
import { toTransactionResponse } from '../transactions/transactions.service';

import { TransferReferences } from './transfer-references';
import type { TransferWithDetails, TransfersRepository } from './transfers.repository';

export function toTransferResponse(tx: TransferWithDetails): TransferResponse {
  const debitEntry = tx.ledgerEntries.find((e) => e.direction === 'DEBIT');
  const creditEntry = tx.ledgerEntries.find((e) => e.direction === 'CREDIT');

  if (!debitEntry || !creditEntry) {
    throw new DomainError('INTERNAL_ERROR', 'Transfert incomplet : écritures manquantes.');
  }

  const txResponse = toTransactionResponse(tx);
  const feeResponse = tx.feeTransaction ? toTransactionResponse(tx.feeTransaction) : null;

  return {
    id: tx.id,
    fromAccountId: debitEntry.accountId,
    toAccountId: creditEntry.accountId,
    fromAmountMinor: debitEntry.amountMinor.toString(),
    toAmountMinor: creditEntry.amountMinor.toString(),
    fromCurrency: debitEntry.currency as CurrencyCode,
    toCurrency: creditEntry.currency as CurrencyCode,
    exchangeRate: tx.rate ? tx.rate.toString() : null,
    rateDate: tx.rateDate ? tx.rateDate.toISOString().slice(0, 10) : null,
    transaction: txResponse,
    fromTransaction: txResponse,
    toTransaction: txResponse,
    feeTransaction: feeResponse,
  };
}

@Injectable()
export class TransfersService {
  constructor(
    private readonly repo: TransfersRepository,
    private readonly references: TransferReferences,
    private readonly ctx: FinanceContext,
    private readonly audit: AuditService,
  ) {}

  private resolveDestinationAmount(
    fromAccount: FinancialAccount,
    toAccount: FinancialAccount,
    input: CreateTransfer,
  ): string {
    const srcCurrency = fromAccount.currency as CurrencyCode;
    const destCurrency = toAccount.currency as CurrencyCode;
    const srcMinor = BigInt(input.fromAmountMinor);

    if (srcCurrency === destCurrency) {
      if (input.toAmountMinor && input.toAmountMinor !== input.fromAmountMinor) {
        throw new DomainError(
          'BUSINESS_RULE_VIOLATION',
          'Les montants doivent être identiques dans la même devise.',
        );
      }
      return input.fromAmountMinor;
    }

    if (!input.exchangeRate || !input.rateDate) {
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        'Un taux de change et une date de taux sont obligatoires pour un transfert multi-devises.',
        { rule: 'EXCHANGE_RATE_REQUIRED' },
      );
    }

    if (input.toAmountMinor) {
      assertDestinationAmountMatches({
        srcMinor,
        srcCurrency,
        destMinor: BigInt(input.toAmountMinor),
        destCurrency,
        rateString: input.exchangeRate,
      });
      return input.toAmountMinor;
    }

    const computed = convertCurrency(srcMinor, srcCurrency, destCurrency, input.exchangeRate);
    return computed.toString();
  }

  private async recordAudit(
    userId: string,
    id: string,
    input: CreateTransfer,
    toAmountMinor: string,
  ): Promise<void> {
    await this.audit.record({
      action: 'finance.transfer.create',
      userId,
      entityType: 'Transaction',
      entityId: id,
      outcome: 'SUCCESS',
      metadata: {
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        fromAmountMinor: input.fromAmountMinor,
        toAmountMinor,
        exchangeRate: input.exchangeRate ?? null,
        feeMinor: input.feeMinor ?? null,
      },
    });
  }

  async create(
    userId: string,
    rawInput: CreateTransferInput,
    idempotencyKey?: string,
  ): Promise<TransferResponse> {
    const input = CreateTransferSchema.parse(rawInput);
    const fromAccount = await this.references.requireAccount(userId, input.fromAccountId);
    const toAccount = await this.references.requireAccount(userId, input.toAccountId);
    const toAmountMinor = this.resolveDestinationAmount(fromAccount, toAccount, input);

    let fee: { id: string; amountMinor: bigint; categoryId?: string | null } | null = null;
    if (input.feeMinor) {
      const categoryId = await this.references.findFeeCategoryId(userId);
      fee = {
        id: this.ctx.newId(),
        amountMinor: BigInt(input.feeMinor),
        categoryId,
      };
    }

    const id = this.ctx.newId();
    const created = await this.repo.createTransfer({
      id,
      userId,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      fromAmountMinor: BigInt(input.fromAmountMinor),
      toAmountMinor: BigInt(toAmountMinor),
      fromCurrency: fromAccount.currency,
      toCurrency: toAccount.currency,
      exchangeRate: input.exchangeRate,
      rateDate: input.rateDate ? new Date(input.rateDate) : undefined,
      occurredAt: new Date(input.occurredAt),
      valueDate: new Date(input.valueDate),
      description: input.description,
      notes: input.notes,
      idempotencyKey,
      fee,
    });

    await this.recordAudit(userId, id, input, toAmountMinor);
    return toTransferResponse(created);
  }

  async getById(userId: string, id: string): Promise<TransferResponse> {
    const tx = await this.repo.findById(userId, id);
    if (!tx) {
      throw new DomainError('NOT_FOUND', 'Transfert introuvable.');
    }
    return toTransferResponse(tx);
  }
}
