import { Injectable } from '@nestjs/common';

import type {
  CancelDebtInput,
  CreateDebt,
  CreateDebtInput,
  CreateRepayment,
  CreateRepaymentInput,
  CurrencyCode,
  DebtResponse,
  DebtSummaryResponse,
  ListDebtsQuery,
  RepaymentResponse,
  UpdateDebt,
  WriteOffDebtInput,
} from '@orbit/contracts';
import {
  CancelDebtSchema,
  CreateDebtSchema,
  CreateRepaymentSchema,
  UpdateDebtSchema,
  WriteOffDebtSchema,
} from '@orbit/contracts';

import { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import { CounterpartiesRepository } from '../counterparties/counterparties.repository';
import { computeDebtRemaining, deriveSettlementStatus, isDebtOverdue } from '../domain/debt-rules';
import { FinanceContext } from '../shared/finance-context';

import type { CreateDebtDbParams, DebtWithRelations, RepaymentWithTransaction } from './debts.repository';
import { DebtsRepository } from './debts.repository';

interface CurrencySummaryAgg {
  readonly totalPayable: bigint;
  readonly totalReceivable: bigint;
  readonly remainingPayable: bigint;
  readonly remainingReceivable: bigint;
  readonly overduePayable: bigint;
  readonly overdueReceivable: bigint;
}

export function toRepaymentResponse(item: RepaymentWithTransaction): RepaymentResponse {
  return {
    id: item.id,
    debtId: item.debtId,
    transactionId: item.transactionId,
    amountMinor: item.amountMinor.toString(),
    currency: item.currency as CurrencyCode,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    transaction: {
      id: item.transaction.id,
      occurredAt: item.transaction.occurredAt.toISOString(),
      valueDate: item.transaction.valueDate.toISOString().slice(0, 10),
      status: item.transaction.status,
      amountMinor: item.transaction.amountMinor.toString(),
      currency: item.transaction.currency as CurrencyCode,
    },
  };
}

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

  private async executeRepaymentDispatch(
    userId: string,
    debtId: string,
    input: CreateRepayment,
  ): Promise<RepaymentWithTransaction> {
    if (input.accountId) {
      return this.repo.createRepaymentWithTransaction({
        id: this.ctx.newId(),
        userId,
        debtId,
        accountId: input.accountId,
        amountMinor: BigInt(input.amountMinor),
        date: input.date,
        notes: input.notes,
        transactionId: this.ctx.newId(),
        ledgerEntryId: this.ctx.newId(),
        occurredAt: this.ctx.now(),
      });
    }

    if (!input.transactionId) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Identifiant de transaction manquant.');
    }

    return this.repo.attachRepayment({
      id: this.ctx.newId(),
      userId,
      debtId,
      transactionId: input.transactionId,
      amountMinor: BigInt(input.amountMinor),
      notes: input.notes,
    });
  }

  private assertDebtRepayable(debt: DebtWithRelations | null, amountMinor: bigint): void {
    if (!debt) {
      throw new DomainError('NOT_FOUND', 'Dette introuvable.');
    }
    if (debt.status !== 'OPEN') {
      throw new DomainError('INVALID_STATE_TRANSITION', 'Impossible de rembourser une dette non ouverte.');
    }
    const remaining = computeDebtRemaining(debt.principalMinor, debt.repayments);
    if (amountMinor > remaining) {
      throw new DomainError('OVERPAYMENT', 'Le montant du remboursement dépasse le solde restant.');
    }
  }

  async createRepayment(
    userId: string,
    debtId: string,
    rawInput: CreateRepaymentInput,
  ): Promise<RepaymentResponse> {
    const input = CreateRepaymentSchema.parse(rawInput);
    const debt = await this.repo.findById(userId, debtId);
    this.assertDebtRepayable(debt, BigInt(input.amountMinor));

    const repayment = await this.executeRepaymentDispatch(userId, debtId, input);

    await this.audit.record({
      action: 'finance.debt.repayment_create',
      userId,
      entityType: 'DebtRepayment',
      entityId: repayment.id,
      outcome: 'SUCCESS',
      metadata: {
        debtId,
        amountMinor: repayment.amountMinor.toString(),
        currency: repayment.currency,
      },
    });

    return toRepaymentResponse(repayment);
  }

  async deleteRepayment(userId: string, debtId: string, repaymentId: string): Promise<void> {
    const debt = await this.repo.findById(userId, debtId);
    if (!debt) {
      throw new DomainError('NOT_FOUND', 'Dette introuvable.');
    }
    const deleted = await this.repo.deleteRepayment(userId, debtId, repaymentId);

    await this.audit.record({
      action: 'finance.debt.repayment_delete',
      userId,
      entityType: 'DebtRepayment',
      entityId: repaymentId,
      outcome: 'SUCCESS',
      metadata: {
        debtId,
        transactionId: deleted.transactionId,
      },
    });
  }

  async listRepayments(userId: string, debtId: string): Promise<RepaymentResponse[]> {
    const debt = await this.repo.findById(userId, debtId);
    if (!debt) {
      throw new DomainError('NOT_FOUND', 'Dette introuvable.');
    }
    const items = await this.repo.listRepayments(userId, debtId);
    return items.map(toRepaymentResponse);
  }

  async cancel(userId: string, id: string, rawInput: CancelDebtInput): Promise<DebtResponse> {
    const input = CancelDebtSchema.parse(rawInput);
    const debt = await this.repo.findById(userId, id);
    if (!debt) {
      throw new DomainError('NOT_FOUND', 'Dette introuvable.');
    }
    if (debt.status !== 'OPEN') {
      throw new DomainError('INVALID_STATE_TRANSITION', "La dette n'est plus ouverte.");
    }
    const hasValidatedRepayments = debt.repayments.some((r) => r.transaction.status === 'VALIDATED');
    if (hasValidatedRepayments) {
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        "Impossible d'annuler une dette ayant des remboursements validés.",
      );
    }

    const cancelled = await this.repo.cancel(userId, id, input.closingReason, this.ctx.now());

    await this.audit.record({
      action: 'finance.debt.cancel',
      userId,
      entityType: 'Debt',
      entityId: id,
      outcome: 'SUCCESS',
      metadata: { closingReason: input.closingReason },
    });

    return toDebtResponse(cancelled, this.getTodayCivil());
  }

  async writeOff(userId: string, id: string, rawInput: WriteOffDebtInput): Promise<DebtResponse> {
    const input = WriteOffDebtSchema.parse(rawInput);
    const debt = await this.repo.findById(userId, id);
    if (!debt) {
      throw new DomainError('NOT_FOUND', 'Dette introuvable.');
    }
    if (debt.status !== 'OPEN') {
      throw new DomainError('INVALID_STATE_TRANSITION', "La dette n'est plus ouverte.");
    }
    if (debt.type !== 'RECEIVABLE') {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Seule une créance peut être passée en perte.');
    }

    const writtenOff = await this.repo.writeOff(userId, id, input.closingReason, this.ctx.now());

    await this.audit.record({
      action: 'finance.debt.write_off',
      userId,
      entityType: 'Debt',
      entityId: id,
      outcome: 'SUCCESS',
      metadata: { closingReason: input.closingReason },
    });

    return toDebtResponse(writtenOff, this.getTodayCivil());
  }

  private accumulateDebtSummary(
    agg: CurrencySummaryAgg,
    debt: DebtWithRelations,
    todayCivil: string,
  ): CurrencySummaryAgg {
    const remaining = computeDebtRemaining(debt.principalMinor, debt.repayments);
    const dueDateCivil = debt.dueDate ? debt.dueDate.toISOString().slice(0, 10) : null;
    const overdue = isDebtOverdue({
      dueDate: dueDateCivil,
      remainingMinor: remaining,
      status: debt.status,
      todayCivil,
    });

    if (debt.type === 'PAYABLE') {
      return {
        ...agg,
        totalPayable: agg.totalPayable + debt.principalMinor,
        remainingPayable: agg.remainingPayable + remaining,
        overduePayable: overdue ? agg.overduePayable + remaining : agg.overduePayable,
      };
    }

    return {
      ...agg,
      totalReceivable: agg.totalReceivable + debt.principalMinor,
      remainingReceivable: agg.remainingReceivable + remaining,
      overdueReceivable: overdue ? agg.overdueReceivable + remaining : agg.overdueReceivable,
    };
  }

  async getSummary(userId: string): Promise<DebtSummaryResponse> {
    const debts = await this.repo.findOpenDebtsForSummary(userId);
    const todayCivil = this.getTodayCivil();
    const map = new Map<string, CurrencySummaryAgg>();

    for (const debt of debts) {
      const existing = map.get(debt.currency) ?? {
        totalPayable: 0n,
        totalReceivable: 0n,
        remainingPayable: 0n,
        remainingReceivable: 0n,
        overduePayable: 0n,
        overdueReceivable: 0n,
      };
      map.set(debt.currency, this.accumulateDebtSummary(existing, debt, todayCivil));
    }

    const currencies = Array.from(map.entries()).map(([currency, agg]) => ({
      currency: currency as CurrencyCode,
      totalPayableMinor: agg.totalPayable.toString(),
      totalReceivableMinor: agg.totalReceivable.toString(),
      remainingPayableMinor: agg.remainingPayable.toString(),
      remainingReceivableMinor: agg.remainingReceivable.toString(),
      overduePayableMinor: agg.overduePayable.toString(),
      overdueReceivableMinor: agg.overdueReceivable.toString(),
    }));

    return { currencies };
  }
}
