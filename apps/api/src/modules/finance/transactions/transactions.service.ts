import { Injectable } from '@nestjs/common';

import type {
  CancelTransaction,
  CreateTransaction,
  CreateTransactionInput,
  CurrencyCode,
  EconomicClass,
  ListTransactionsQuery,
  TransactionResponse,
  TransactionSource,
  TransactionType,
  UpdateTransactionDetails,
} from '@orbit/contracts';
import {
  CancelTransactionSchema,
  CreateTransactionSchema,
  UpdateTransactionDetailsSchema,
} from '@orbit/contracts';

import { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import { resolveEconomicClass } from '../domain/economic-classification';
import { buildStandardLedgerEntries } from '../domain/ledger-entry-builder';
import { FinanceContext } from '../shared/finance-context';

import { TransactionReferences } from './transaction-references';
import { TransactionsRepository, type TransactionWithEntries } from './transactions.repository';

export function toTransactionResponse(tx: TransactionWithEntries): TransactionResponse {
  return {
    id: tx.id,
    type: tx.type as TransactionType,
    status: tx.status,
    economicClass: tx.economicClass,
    amountMinor: tx.amountMinor.toString(),
    currency: tx.currency as CurrencyCode,
    occurredAt: tx.occurredAt.toISOString(),
    valueDate: tx.valueDate.toISOString().slice(0, 10),
    source: tx.source as TransactionSource,
    description: tx.description,
    notes: tx.notes,
    categoryId: tx.categoryId,
    counterpartyId: tx.counterpartyId,
    transferId: tx.parentTransactionId,
    cancelReason: tx.cancelReason,
    cancelledAt: tx.cancelledAt ? tx.cancelledAt.toISOString() : null,
    ledgerEntries: tx.ledgerEntries.map((e) => ({
      id: e.id,
      transactionId: e.transactionId,
      accountId: e.accountId,
      direction: e.direction,
      amountMinor: e.amountMinor.toString(),
      currency: e.currency as CurrencyCode,
      createdAt: e.createdAt.toISOString(),
    })),
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  };
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly repo: TransactionsRepository,
    private readonly references: TransactionReferences,
    private readonly ctx: FinanceContext,
    private readonly audit: AuditService,
  ) {}

  private validateAdjustment(input: CreateTransaction): void {
    if (input.type === 'ADJUSTMENT') {
      if (input.status !== 'VALIDATED') {
        throw new DomainError(
          'BUSINESS_RULE_VIOLATION',
          "Une transaction d'ajustement doit être obligatoirement validée (VALIDATED).",
        );
      }
      if (!input.description || input.description.trim().length === 0) {
        throw new DomainError(
          'BUSINESS_RULE_VIOLATION',
          "Un motif (description) est obligatoire pour une transaction d'ajustement.",
        );
      }
    }
  }

  private buildEntries(input: CreateTransaction) {
    const builtEntries = buildStandardLedgerEntries({
      type: input.type,
      accountId: input.accountId,
      accountCurrency: input.currency,
      amountMinor: BigInt(input.amountMinor),
      currency: input.currency,
      adjustmentDirection: input.adjustmentDirection,
    });

    return builtEntries.map((b) => ({
      id: this.ctx.newId(),
      accountId: b.accountId,
      direction: b.direction,
      amountMinor: b.amountMinor,
      currency: b.currency,
    }));
  }

  private async recordCreateAudit(
    userId: string,
    id: string,
    type: string,
    created: TransactionWithEntries,
  ): Promise<void> {
    await this.audit.record({
      action: type === 'ADJUSTMENT' ? 'finance.adjustment.create' : 'finance.transaction.create',
      userId,
      entityType: 'Transaction',
      entityId: id,
      outcome: 'SUCCESS',
      metadata: {
        type,
        status: created.status,
        currency: created.currency,
        amountMinor: created.amountMinor.toString(),
      },
    });
  }

  async create(
    userId: string,
    rawInput: CreateTransactionInput,
    idempotencyKey?: string,
  ): Promise<TransactionResponse> {
    const input = CreateTransactionSchema.parse(rawInput);
    this.validateAdjustment(input);

    let defaultClass: EconomicClass | undefined;
    if (input.categoryId) {
      defaultClass = (await this.references.validateCategory(
        userId,
        input.categoryId,
        input.type,
      )) as EconomicClass;
    }
    if (input.counterpartyId) {
      await this.references.validateCounterparty(userId, input.counterpartyId);
    }

    const economicClass = input.economicClass ?? resolveEconomicClass(input.type, 'STANDARD', defaultClass);
    const ledgerEntries = this.buildEntries(input);
    const id = this.ctx.newId();

    const created = await this.repo.create({
      id,
      userId,
      type: input.type,
      status: input.status,
      economicClass,
      amountMinor: BigInt(input.amountMinor),
      currency: input.currency,
      occurredAt: new Date(input.occurredAt),
      valueDate: new Date(input.valueDate),
      description: input.description,
      notes: input.notes,
      categoryId: input.categoryId,
      counterpartyId: input.counterpartyId,
      source: 'MANUAL',
      idempotencyKey,
      ledgerEntries,
    });

    await this.recordCreateAudit(userId, id, input.type, created);

    return toTransactionResponse(created);
  }

  async getById(userId: string, id: string): Promise<TransactionResponse> {
    const tx = await this.repo.findById(userId, id);
    if (!tx) {
      throw new DomainError('NOT_FOUND', 'Transaction introuvable.');
    }
    return toTransactionResponse(tx);
  }

  async list(
    userId: string,
    query: ListTransactionsQuery,
  ): Promise<{ items: TransactionResponse[]; nextCursor: string | null; hasMore: boolean }> {
    const result = await this.repo.list(userId, {
      limit: query.limit,
      cursor: query.cursor,
      accountId: query.accountId,
      categoryId: query.categoryId,
      counterpartyId: query.counterpartyId,
      type: query.type,
      status: query.status,
      fromDate: query.fromDate,
      toDate: query.toDate,
      search: query.search,
    });

    return {
      items: result.rows.map(toTransactionResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async updateDetails(
    userId: string,
    id: string,
    rawInput: UpdateTransactionDetails,
  ): Promise<TransactionResponse> {
    const input = UpdateTransactionDetailsSchema.parse(rawInput);

    const existing = await this.repo.findById(userId, id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Transaction introuvable.');
    }

    if (input.categoryId) {
      await this.references.validateCategory(userId, input.categoryId, existing.type as TransactionType);
    }
    if (input.counterpartyId) {
      await this.references.validateCounterparty(userId, input.counterpartyId);
    }

    const updated = await this.repo.updateDetails(userId, id, {
      description: input.description,
      notes: input.notes,
      categoryId: input.categoryId,
      counterpartyId: input.counterpartyId,
      valueDate: input.valueDate ? new Date(input.valueDate) : undefined,
    });

    await this.audit.record({
      action: 'finance.transaction.update',
      userId,
      entityType: 'Transaction',
      entityId: id,
      outcome: 'SUCCESS',
      metadata: {
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
      },
    });

    return toTransactionResponse(updated);
  }

  async validate(userId: string, id: string): Promise<TransactionResponse> {
    const validated = await this.repo.validate(userId, id);

    await this.audit.record({
      action: 'finance.transaction.validate',
      userId,
      entityType: 'Transaction',
      entityId: id,
      outcome: 'SUCCESS',
      metadata: {
        amountMinor: validated.amountMinor.toString(),
        currency: validated.currency,
      },
    });

    return toTransactionResponse(validated);
  }

  async cancel(userId: string, id: string, rawInput: CancelTransaction): Promise<TransactionResponse> {
    const input = CancelTransactionSchema.parse(rawInput);
    const cancelled = await this.repo.cancel(userId, id, input.reason);

    await this.audit.record({
      action: 'finance.transaction.cancel',
      userId,
      entityType: 'Transaction',
      entityId: id,
      outcome: 'SUCCESS',
      metadata: {
        reason: input.reason,
      },
    });

    return toTransactionResponse(cancelled);
  }
}
