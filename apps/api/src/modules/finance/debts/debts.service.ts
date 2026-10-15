import { Injectable } from '@nestjs/common';

import type {
  CreateDebt,
  CreateDebtInput,
  CurrencyCode,
  DebtResponse,
  ListDebtsQuery,
  UpdateDebt,
} from '@orbit/contracts';
import { CreateDebtSchema, UpdateDebtSchema } from '@orbit/contracts';

import { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import type { CounterpartiesRepository } from '../counterparties/counterparties.repository';
import { computeDebtRemaining, deriveSettlementStatus, isDebtOverdue } from '../domain/debt-rules';
import { FinanceContext } from '../shared/finance-context';

import type { CreateDebtDbParams, DebtWithRelations } from './debts.repository';
import { DebtsRepository } from './debts.repository';

export function toDebtResponse(debt: DebtWithRelations, todayCivil: string): DebtResponse {
  const repaymentsList = debt.repayments.map((r) => ({
    amountMinor: r.amountMinor,
    transactionStatus: r.transaction.status,
  }));

  const remaining = computeDebtRemaining(debt.principalMinor, repaymentsList);
  const repaid = debt.principalMinor - remaining;
  const settlementStatus = deriveSettlementStatus(debt.principalMinor, remaining);
  const dueDateStr = debt.dueDate ? debt.dueDate.toISOString().slice(0, 10) : null;
  const overdue = isDebtOverdue({
    dueDate: dueDateStr,
    remainingMinor: remaining,
    status: debt.status,
    todayCivil,
  });

  return {
    id: debt.id,
    userId: debt.userId,
    type: debt.type,
    counterpartyId: debt.counterpartyId,
    title: debt.title,
    description: debt.description,
    principalMinor: debt.principalMinor.toString(),
    currency: debt.currency as CurrencyCode,
    openedOn: debt.openedOn.toISOString().slice(0, 10),
    dueDate: dueDateStr,
    status: debt.status,
    cancelledAt: debt.cancelledAt ? debt.cancelledAt.toISOString() : null,
    writtenOffAt: debt.writtenOffAt ? debt.writtenOffAt.toISOString() : null,
    closingReason: debt.closingReason,
    notes: debt.notes,
    totalRepaidMinor: repaid.toString(),
    remainingMinor: remaining.toString(),
    settlementStatus,
    isOverdue: overdue,
    counterparty: debt.counterparty,
    createdAt: debt.createdAt.toISOString(),
    updatedAt: debt.updatedAt.toISOString(),
  };
}

@Injectable()
export class DebtsService {
  constructor(
    private readonly repo: DebtsRepository,
    private readonly counterpartiesRepo: CounterpartiesRepository,
    private readonly ctx: FinanceContext,
    private readonly audit: AuditService,
  ) {}

  private getTodayCivil(): string {
    return this.ctx.now().toISOString().slice(0, 10);
  }

  private async assertCounterpartyExists(userId: string, counterpartyId: string): Promise<void> {
    const counterparty = await this.counterpartiesRepo.findById(userId, counterpartyId);
    if (!counterparty) {
      throw new DomainError('NOT_FOUND', 'Contrepartie introuvable.');
    }
  }

  private buildCreateParams(id: string, userId: string, input: CreateDebt): CreateDebtDbParams {
    const initialMovement = input.initialMovement
      ? {
          accountId: input.initialMovement.accountId,
          valueDate: input.initialMovement.valueDate ? new Date(input.initialMovement.valueDate) : undefined,
          transactionId: this.ctx.newId(),
          ledgerEntryId: this.ctx.newId(),
          occurredAt: this.ctx.now(),
        }
      : null;

    return {
      id,
      userId,
      type: input.type,
      counterpartyId: input.counterpartyId,
      title: input.title,
      description: input.description,
      principalMinor: BigInt(input.principalMinor),
      currency: input.currency,
      openedOn: new Date(input.openedOn),
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      notes: input.notes,
      initialMovement,
    };
  }

  async create(userId: string, rawInput: CreateDebtInput): Promise<DebtResponse> {
    const input = CreateDebtSchema.parse(rawInput);
    await this.assertCounterpartyExists(userId, input.counterpartyId);

    const id = this.ctx.newId();
    const params = this.buildCreateParams(id, userId, input);
    const created = await this.repo.create(params);

    await this.audit.record({
      action: 'finance.debt.create',
      userId,
      entityType: 'Debt',
      entityId: id,
      outcome: 'SUCCESS',
      metadata: {
        type: created.type,
        currency: created.currency,
        principalMinor: created.principalMinor.toString(),
        hasInitialMovement: Boolean(input.initialMovement),
      },
    });

    return toDebtResponse(created, this.getTodayCivil());
  }

  async getById(userId: string, id: string): Promise<DebtResponse> {
    const debt = await this.repo.findById(userId, id);
    if (!debt) {
      throw new DomainError('NOT_FOUND', 'Dette introuvable.');
    }
    return toDebtResponse(debt, this.getTodayCivil());
  }

  async list(userId: string, query: ListDebtsQuery): Promise<{ items: DebtResponse[]; nextCursor?: string }> {
    const todayCivil = this.getTodayCivil();
    const { items, nextCursor } = await this.repo.list(userId, {
      ...query,
      todayCivil,
    });

    return {
      items: items.map((d) => toDebtResponse(d, todayCivil)),
      nextCursor,
    };
  }

  async update(userId: string, id: string, rawInput: UpdateDebt): Promise<DebtResponse> {
    const input = UpdateDebtSchema.parse(rawInput);
    const existing = await this.repo.findById(userId, id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Dette introuvable.');
    }
    if (existing.status !== 'OPEN') {
      throw new DomainError(
        'INVALID_STATE_TRANSITION',
        'Impossible de modifier une dette clôturée (annulée ou radiée).',
      );
    }

    if (input.dueDate !== undefined && input.dueDate !== null) {
      const newDue = new Date(input.dueDate);
      if (newDue < existing.openedOn) {
        throw new DomainError(
          'BUSINESS_RULE_VIOLATION',
          "La date d'échéance doit être postérieure ou égale à la date d'ouverture.",
        );
      }
    }

    const updated = await this.repo.update(userId, id, {
      title: input.title,
      description: input.description,
      dueDate:
        input.dueDate !== undefined ? (input.dueDate !== null ? new Date(input.dueDate) : null) : undefined,
      notes: input.notes,
    });

    if (input.dueDate !== undefined) {
      await this.audit.record({
        action: 'finance.debt.rescheduled',
        userId,
        entityType: 'Debt',
        entityId: id,
        outcome: 'SUCCESS',
        metadata: {
          newDueDate: input.dueDate ?? 'none',
        },
      });
    }

    await this.audit.record({
      action: 'finance.debt.update',
      userId,
      entityType: 'Debt',
      entityId: id,
      outcome: 'SUCCESS',
    });

    return toDebtResponse(updated, this.getTodayCivil());
  }
}
