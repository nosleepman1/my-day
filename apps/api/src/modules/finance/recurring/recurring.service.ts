import { Injectable } from '@nestjs/common';

import type {
  CreateRecurringTransactionInput,
  CurrencyCode,
  ListRecurringTransactionsQuery,
  RecurringTransactionResponse,
  UpdateRecurringTransactionInput,
} from '@orbit/contracts';
import {
  CreateRecurringTransactionSchema,
  ListRecurringTransactionsQuerySchema,
  UpdateRecurringTransactionSchema,
} from '@orbit/contracts';

import { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import { generateOccurrences, parseFinanceRecurrence } from '../domain/recurrence-rules';
import { FinanceContext } from '../shared/finance-context';

import type {
  CreateRecurringDbParams,
  RecurringTransactionWithRelations,
  UpdateRecurringDbParams,
} from './recurring.repository';
import { RecurringRepository } from './recurring.repository';

export function toRecurringResponse(item: RecurringTransactionWithRelations): RecurringTransactionResponse {
  return {
    id: item.id,
    userId: item.userId,
    name: item.name,
    type: item.type,
    economicClass: item.economicClass,
    amountMinor: item.amountMinor.toString(),
    currency: item.currency as CurrencyCode,
    accountId: item.accountId,
    destinationAccountId: item.destinationAccountId,
    categoryId: item.categoryId,
    counterpartyId: item.counterpartyId,
    projectId: item.projectId,
    generationMode: item.generationMode,
    reminderDaysBefore: item.reminderDaysBefore,
    status: item.status,
    recurrenceRule: item.recurrenceRule,
    recurrenceAnchorOn: item.recurrenceAnchorOn.toISOString().slice(0, 10),
    recurrenceTimezone: item.recurrenceTimezone,
    recurrenceLocalTime: item.recurrenceLocalTime
      ? item.recurrenceLocalTime.toISOString().slice(11, 16)
      : null,
    nextOccurrenceAt: item.nextOccurrenceAt ? item.nextOccurrenceAt.toISOString() : null,
    generatedUntil: item.generatedUntil ? item.generatedUntil.toISOString().slice(0, 10) : null,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

@Injectable()
export class RecurringService {
  constructor(
    private readonly repo: RecurringRepository,
    private readonly ctx: FinanceContext,
    private readonly audit: AuditService,
  ) {}

  private getTodayCivil(): string {
    return this.ctx.now().toISOString().slice(0, 10);
  }

  private calculateNextOccurrence(
    recurrenceRule: string,
    anchorDate: string,
    todayCivil: string,
  ): Date | null {
    const fromEpoch = Date.parse(`${todayCivil}T00:00:00.000Z`);
    const oneYearLaterEpoch = fromEpoch + 365 * 86_400_000;
    const toDate = new Date(oneYearLaterEpoch).toISOString().slice(0, 10);

    const occurrences = generateOccurrences({
      recurrenceRule,
      anchorDate,
      fromDate: todayCivil,
      toDate,
      maxCount: 20,
    });

    if (occurrences.length === 0 || !occurrences[0]) {
      return null;
    }

    return new Date(`${occurrences[0]}T00:00:00.000Z`);
  }

  private async validateAccount(userId: string, accountId: string, expectedCurrency?: string): Promise<void> {
    const account = await this.ctx.db.financialAccount.findFirst({
      where: { userId, id: accountId },
    });
    if (!account) {
      throw new DomainError('NOT_FOUND', 'Compte financier introuvable.');
    }
    if (expectedCurrency && account.currency !== expectedCurrency) {
      throw new DomainError('CURRENCY_MISMATCH', 'Devise incompatible avec le compte.');
    }
  }

  private async validateCategory(userId: string, categoryId?: string | null): Promise<void> {
    if (!categoryId) return;
    const cat = await this.ctx.db.transactionCategory.findFirst({
      where: { userId, id: categoryId },
    });
    if (!cat) {
      throw new DomainError('NOT_FOUND', 'Catégorie introuvable.');
    }
  }

  private async validateCounterparty(userId: string, counterpartyId?: string | null): Promise<void> {
    if (!counterpartyId) return;
    const cp = await this.ctx.db.counterparty.findFirst({
      where: { userId, id: counterpartyId },
    });
    if (!cp) {
      throw new DomainError('NOT_FOUND', 'Contrepartie introuvable.');
    }
  }

  private async validateAllRelations(
    userId: string,
    input: {
      accountId?: string;
      destinationAccountId?: string | null;
      categoryId?: string | null;
      counterpartyId?: string | null;
      currency?: string;
    },
  ): Promise<void> {
    if (input.accountId) {
      await this.validateAccount(userId, input.accountId, input.currency);
    }
    if (input.destinationAccountId) {
      await this.validateAccount(userId, input.destinationAccountId, input.currency);
    }
    await this.validateCategory(userId, input.categoryId);
    await this.validateCounterparty(userId, input.counterpartyId);
  }

  private buildCreateDbParams(
    userId: string,
    input: ReturnType<typeof CreateRecurringTransactionSchema.parse>,
    nextOccurrenceAt: Date | null,
  ): CreateRecurringDbParams {
    return {
      id: this.ctx.newId(),
      userId,
      name: input.name,
      type: input.type,
      economicClass: input.economicClass,
      amountMinor: BigInt(input.amountMinor),
      currency: input.currency,
      accountId: input.accountId,
      destinationAccountId: input.destinationAccountId,
      categoryId: input.categoryId,
      counterpartyId: input.counterpartyId,
      projectId: input.projectId,
      generationMode: input.generationMode,
      reminderDaysBefore: input.reminderDaysBefore,
      recurrenceRule: input.recurrenceRule,
      recurrenceAnchorOn: new Date(`${input.recurrenceAnchorOn}T00:00:00.000Z`),
      recurrenceTimezone: input.recurrenceTimezone,
      nextOccurrenceAt,
      notes: input.notes,
    };
  }

  async create(
    userId: string,
    rawInput: CreateRecurringTransactionInput,
  ): Promise<RecurringTransactionResponse> {
    const input = CreateRecurringTransactionSchema.parse(rawInput);
    if (!parseFinanceRecurrence(input.recurrenceRule)) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Règle de récurrence invalide.');
    }

    await this.validateAllRelations(userId, {
      accountId: input.accountId,
      destinationAccountId: input.destinationAccountId,
      categoryId: input.categoryId,
      counterpartyId: input.counterpartyId,
      currency: input.currency,
    });

    const nextOccurrenceAt = this.calculateNextOccurrence(
      input.recurrenceRule,
      input.recurrenceAnchorOn,
      this.getTodayCivil(),
    );

    const dbParams = this.buildCreateDbParams(userId, input, nextOccurrenceAt);
    const created = await this.repo.create(dbParams);

    await this.audit.record({
      action: 'finance.recurring.create',
      userId,
      entityType: 'RecurringTransaction',
      entityId: created.id,
      outcome: 'SUCCESS',
      metadata: { name: created.name, amountMinor: created.amountMinor.toString() },
    });

    return toRecurringResponse(created);
  }

  async getById(userId: string, id: string): Promise<RecurringTransactionResponse> {
    const item = await this.repo.findById(userId, id);
    if (!item) {
      throw new DomainError('NOT_FOUND', 'Transaction récurrente introuvable.');
    }
    return toRecurringResponse(item);
  }

  async list(
    userId: string,
    rawQuery: ListRecurringTransactionsQuery,
  ): Promise<{ items: RecurringTransactionResponse[]; nextCursor?: string }> {
    const query = ListRecurringTransactionsQuerySchema.parse(rawQuery);
    const { items, nextCursor } = await this.repo.list(userId, query);
    return {
      items: items.map(toRecurringResponse),
      nextCursor,
    };
  }

  private buildUpdateDbParams(
    input: ReturnType<typeof UpdateRecurringTransactionSchema.parse>,
    nextOccurrenceAt?: Date | null,
  ): UpdateRecurringDbParams {
    return {
      name: input.name,
      amountMinor: input.amountMinor ? BigInt(input.amountMinor) : undefined,
      accountId: input.accountId,
      destinationAccountId: input.destinationAccountId,
      categoryId: input.categoryId,
      counterpartyId: input.counterpartyId,
      projectId: input.projectId,
      generationMode: input.generationMode,
      reminderDaysBefore: input.reminderDaysBefore,
      recurrenceRule: input.recurrenceRule,
      recurrenceTimezone: input.recurrenceTimezone,
      nextOccurrenceAt,
      notes: input.notes,
    };
  }

  async update(
    userId: string,
    id: string,
    rawInput: UpdateRecurringTransactionInput,
  ): Promise<RecurringTransactionResponse> {
    const input = UpdateRecurringTransactionSchema.parse(rawInput);
    const existing = await this.repo.findById(userId, id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Transaction récurrente introuvable.');
    }

    if (input.recurrenceRule && !parseFinanceRecurrence(input.recurrenceRule)) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Règle de récurrence invalide.');
    }

    await this.validateAllRelations(userId, {
      accountId: input.accountId,
      destinationAccountId: input.destinationAccountId,
      categoryId: input.categoryId,
      counterpartyId: input.counterpartyId,
      currency: existing.currency,
    });

    const ruleToUse = input.recurrenceRule ?? existing.recurrenceRule;
    const anchorCivil = existing.recurrenceAnchorOn.toISOString().slice(0, 10);
    const nextOccurrenceAt =
      existing.status === 'ACTIVE'
        ? this.calculateNextOccurrence(ruleToUse, anchorCivil, this.getTodayCivil())
        : existing.nextOccurrenceAt;

    const dbParams = this.buildUpdateDbParams(input, nextOccurrenceAt);
    const updated = await this.repo.update(userId, id, dbParams);

    await this.audit.record({
      action: 'finance.recurring.update',
      userId,
      entityType: 'RecurringTransaction',
      entityId: id,
      outcome: 'SUCCESS',
      metadata: { name: updated.name },
    });

    return toRecurringResponse(updated);
  }

  async pause(userId: string, id: string): Promise<RecurringTransactionResponse> {
    const existing = await this.repo.findById(userId, id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Transaction récurrente introuvable.');
    }
    if (existing.status === 'ENDED') {
      throw new DomainError('INVALID_STATE_TRANSITION', 'Impossible de suspendre une récurrence terminée.');
    }

    const updated = await this.repo.updateStatus(userId, id, 'PAUSED', null);

    await this.audit.record({
      action: 'finance.recurring.pause',
      userId,
      entityType: 'RecurringTransaction',
      entityId: id,
      outcome: 'SUCCESS',
      metadata: { name: updated.name },
    });

    return toRecurringResponse(updated);
  }

  async resume(userId: string, id: string): Promise<RecurringTransactionResponse> {
    const existing = await this.repo.findById(userId, id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Transaction récurrente introuvable.');
    }
    if (existing.status === 'ENDED') {
      throw new DomainError('INVALID_STATE_TRANSITION', 'Impossible de réactiver une récurrence terminée.');
    }

    const anchorCivil = existing.recurrenceAnchorOn.toISOString().slice(0, 10);
    const nextOccurrenceAt = this.calculateNextOccurrence(
      existing.recurrenceRule,
      anchorCivil,
      this.getTodayCivil(),
    );

    const updated = await this.repo.updateStatus(userId, id, 'ACTIVE', nextOccurrenceAt);

    await this.audit.record({
      action: 'finance.recurring.resume',
      userId,
      entityType: 'RecurringTransaction',
      entityId: id,
      outcome: 'SUCCESS',
      metadata: { name: updated.name },
    });

    return toRecurringResponse(updated);
  }

  async terminate(userId: string, id: string): Promise<RecurringTransactionResponse> {
    const existing = await this.repo.findById(userId, id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Transaction récurrente introuvable.');
    }

    const updated = await this.repo.updateStatus(userId, id, 'ENDED', null);

    await this.audit.record({
      action: 'finance.recurring.terminate',
      userId,
      entityType: 'RecurringTransaction',
      entityId: id,
      outcome: 'SUCCESS',
      metadata: { name: updated.name },
    });

    return toRecurringResponse(updated);
  }
}
