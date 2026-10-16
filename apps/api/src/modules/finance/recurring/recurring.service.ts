import { Injectable } from '@nestjs/common';

import type {
  ConfirmOccurrenceInput,
  CreateRecurringTransactionInput,
  CurrencyCode,
  ListOccurrencesQuery,
  ListRecurringTransactionsQuery,
  RecurringOccurrenceResponse,
  RecurringTransactionResponse,
  SkipOccurrenceInput,
  UpdateRecurringTransactionInput,
} from '@orbit/contracts';
import {
  ConfirmOccurrenceSchema,
  CreateRecurringTransactionSchema,
  ListRecurringTransactionsQuerySchema,
  SkipOccurrenceSchema,
  UpdateRecurringTransactionSchema,
} from '@orbit/contracts';

import { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import { generateOccurrences, isOccurrenceOverdue, parseFinanceRecurrence } from '../domain/recurrence-rules';
import { FinanceContext } from '../shared/finance-context';

import type {
  CreateOccurrenceDbParams,
  CreateRecurringDbParams,
  OccurrenceWithRelations,
  RecurringTransactionWithRelations,
  UpdateRecurringDbParams,
} from './recurring.repository';
import { RecurringRepository } from './recurring.repository';

export function toOccurrenceResponse(
  item: OccurrenceWithRelations,
  todayCivil: string,
): RecurringOccurrenceResponse {
  const dueOnStr = item.dueOn.toISOString().slice(0, 10);
  return {
    id: item.id,
    userId: item.userId,
    recurringTransactionId: item.recurringTransactionId,
    dueOn: dueOnStr,
    expectedAmountMinor: item.expectedAmountMinor.toString(),
    currency: item.currency as CurrencyCode,
    status: item.status,
    transactionId: item.transactionId,
    confirmedAt: item.confirmedAt ? item.confirmedAt.toISOString() : null,
    skippedAt: item.skippedAt ? item.skippedAt.toISOString() : null,
    createdAt: item.createdAt.toISOString(),
    isOverdue: isOccurrenceOverdue({
      dueOn: dueOnStr,
      status: item.status,
      todayCivil,
    }),
    recurringTransaction: item.recurringTransaction
      ? {
          id: item.recurringTransaction.id,
          name: item.recurringTransaction.name,
          type: item.recurringTransaction.type,
          economicClass: item.recurringTransaction.economicClass,
          accountId: item.recurringTransaction.accountId,
        }
      : undefined,
  };
}

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

  async materializeOccurrences(
    userId: string,
    recurringTransactionId: string,
    toDateCivil: string,
  ): Promise<number> {
    const recurring = await this.repo.findById(userId, recurringTransactionId);
    if (!recurring) {
      throw new DomainError('NOT_FOUND', 'Transaction récurrente introuvable.');
    }

    const anchorDate = recurring.recurrenceAnchorOn.toISOString().slice(0, 10);
    const dates = generateOccurrences({
      recurrenceRule: recurring.recurrenceRule,
      anchorDate,
      fromDate: anchorDate,
      toDate: toDateCivil,
    });

    const items: CreateOccurrenceDbParams[] = dates.map((dueOnCivil) => ({
      id: this.ctx.newId(),
      userId,
      recurringTransactionId,
      dueOn: new Date(`${dueOnCivil}T00:00:00.000Z`),
      expectedAmountMinor: recurring.amountMinor,
      currency: recurring.currency,
      status: 'EXPECTED',
    }));

    return this.repo.createOccurrencesBatch(items);
  }

  async listOccurrences(
    userId: string,
    query: ListOccurrencesQuery,
  ): Promise<{ items: RecurringOccurrenceResponse[]; nextCursor?: string }> {
    const { items, nextCursor } = await this.repo.listOccurrences(userId, {
      from: query.from,
      to: query.to,
      status: query.status,
      recurringTransactionId: query.recurringTransactionId,
      accountId: query.accountId,
      limit: query.limit,
      cursor: query.cursor,
    });
    const todayCivil = this.getTodayCivil();
    return {
      items: items.map((item) => toOccurrenceResponse(item, todayCivil)),
      nextCursor,
    };
  }

  async getOccurrenceById(userId: string, id: string): Promise<RecurringOccurrenceResponse> {
    const item = await this.repo.findOccurrenceById(userId, id);
    if (!item) {
      throw new DomainError('NOT_FOUND', 'Occurrence introuvable.');
    }
    return toOccurrenceResponse(item, this.getTodayCivil());
  }

  private async attachExistingTransaction(
    userId: string,
    occurrenceId: string,
    transactionId: string,
    currency: string,
  ): Promise<OccurrenceWithRelations> {
    const tx = await this.ctx.db.transaction.findFirst({
      where: { userId, id: transactionId },
    });
    if (!tx) {
      throw new DomainError('NOT_FOUND', 'Transaction introuvable.');
    }
    if (tx.status !== 'VALIDATED') {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Seule une transaction validée peut être rattachée.');
    }
    if (tx.currency !== currency) {
      throw new DomainError('CURRENCY_MISMATCH', 'Devise incompatible entre la transaction et l’occurrence.');
    }

    const alreadyRepayment = await this.ctx.db.debtRepayment.findFirst({
      where: { userId, transactionId },
    });
    if (alreadyRepayment) {
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        'Cette transaction est déjà rattachée à un remboursement de dette.',
      );
    }

    const updated = await this.repo.attachOccurrenceTransaction(
      userId,
      occurrenceId,
      transactionId,
      this.ctx.now(),
    );

    await this.audit.record({
      action: 'finance.recurring.occurrence_confirm',
      userId,
      entityType: 'RecurringOccurrence',
      entityId: occurrenceId,
      outcome: 'SUCCESS',
      metadata: { transactionId },
    });

    return updated;
  }

  private async createAndConfirmTransaction(
    userId: string,
    occurrence: OccurrenceWithRelations,
    input: ReturnType<typeof ConfirmOccurrenceSchema.parse>,
  ): Promise<OccurrenceWithRelations> {
    const rec = occurrence.recurringTransaction;
    if (!rec) {
      throw new DomainError('NOT_FOUND', 'Transaction récurrente parente introuvable.');
    }

    const valueDate = input.valueDate ? new Date(`${input.valueDate}T00:00:00.000Z`) : occurrence.dueOn;
    const amountMinor = input.amountMinor ? BigInt(input.amountMinor) : occurrence.expectedAmountMinor;
    const accountId = input.accountId ?? rec.accountId;
    const destinationAccountId = rec.destinationAccountId ?? null;
    const description = input.notes ? `${rec.name} - ${input.notes}` : rec.name;

    const updated = await this.repo.confirmOccurrenceWithTransaction({
      userId,
      occurrenceId: occurrence.id,
      transactionId: this.ctx.newId(),
      ledgerEntryId: this.ctx.newId(),
      destinationLedgerEntryId: destinationAccountId ? this.ctx.newId() : null,
      accountId,
      destinationAccountId,
      amountMinor,
      currency: occurrence.currency,
      type: rec.type,
      economicClass: rec.economicClass,
      valueDate,
      description,
      categoryId: rec.categoryId,
      counterpartyId: rec.counterpartyId,
      projectId: rec.projectId,
      confirmedAt: this.ctx.now(),
    });

    await this.audit.record({
      action: 'finance.recurring.occurrence_confirm',
      userId,
      entityType: 'RecurringOccurrence',
      entityId: occurrence.id,
      outcome: 'SUCCESS',
      metadata: { transactionId: updated.transactionId },
    });

    return updated;
  }

  async confirmOccurrence(
    userId: string,
    occurrenceId: string,
    rawInput: ConfirmOccurrenceInput,
  ): Promise<RecurringOccurrenceResponse> {
    const input = ConfirmOccurrenceSchema.parse(rawInput);
    const occurrence = await this.repo.findOccurrenceById(userId, occurrenceId);
    if (!occurrence) {
      throw new DomainError('NOT_FOUND', 'Occurrence introuvable.');
    }

    if (occurrence.status === 'SKIPPED') {
      throw new DomainError('INVALID_STATE_TRANSITION', 'Impossible de confirmer une occurrence ignorée.');
    }
    if (occurrence.status === 'CONFIRMED') {
      return toOccurrenceResponse(occurrence, this.getTodayCivil());
    }

    const updated = input.transactionId
      ? await this.attachExistingTransaction(userId, occurrenceId, input.transactionId, occurrence.currency)
      : await this.createAndConfirmTransaction(userId, occurrence, input);

    return toOccurrenceResponse(updated, this.getTodayCivil());
  }

  async skipOccurrence(
    userId: string,
    occurrenceId: string,
    rawInput: SkipOccurrenceInput,
  ): Promise<RecurringOccurrenceResponse> {
    const input = SkipOccurrenceSchema.parse(rawInput);
    const occurrence = await this.repo.findOccurrenceById(userId, occurrenceId);
    if (!occurrence) {
      throw new DomainError('NOT_FOUND', 'Occurrence introuvable.');
    }

    if (occurrence.status === 'CONFIRMED') {
      throw new DomainError(
        'INVALID_STATE_TRANSITION',
        'Impossible d’ignorer une occurrence déjà confirmée.',
      );
    }
    if (occurrence.status === 'SKIPPED') {
      return toOccurrenceResponse(occurrence, this.getTodayCivil());
    }

    const updated = await this.repo.skipOccurrence(userId, occurrenceId, this.ctx.now());

    await this.audit.record({
      action: 'finance.recurring.occurrence_skip',
      userId,
      entityType: 'RecurringOccurrence',
      entityId: occurrenceId,
      outcome: 'SUCCESS',
      metadata: { reason: input.reason },
    });

    return toOccurrenceResponse(updated, this.getTodayCivil());
  }
}
