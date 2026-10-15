import { Injectable } from '@nestjs/common';
import type { FinancialAccount } from '@prisma/client';

import type {
  AccountAdjustmentInput,
  ConfirmReconciliation,
  ReconciliationQuery,
  ReconciliationResult,
  ReconciliationStatusResponse,
  TransactionResponse,
} from '@orbit/contracts';
import {
  AccountAdjustmentSchema,
  ConfirmReconciliationSchema,
  ReconciliationQuerySchema,
} from '@orbit/contracts';

import { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import { AccountsRepository } from '../accounts/accounts.repository';
import { assertValidAdjustment, calculateReconciliation } from '../domain/adjustment-rules';
import { FinanceContext } from '../shared/finance-context';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly ctx: FinanceContext,
    private readonly accountsRepo: AccountsRepository,
    private readonly transactionsService: TransactionsService,
    private readonly audit: AuditService,
  ) {}

  private async getActiveAccount(userId: string, accountId: string): Promise<FinancialAccount> {
    const account = await this.accountsRepo.findById(userId, accountId);
    if (!account) {
      throw new DomainError('NOT_FOUND', 'Compte financier introuvable.');
    }
    if (account.archivedAt !== null) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Opération impossible sur un compte archivé.', {
        accountId,
      });
    }
    return account;
  }

  async adjust(accountId: string, rawInput: AccountAdjustmentInput): Promise<TransactionResponse> {
    const input = AccountAdjustmentSchema.parse(rawInput);
    const userId = this.ctx.userId();
    const account = await this.getActiveAccount(userId, accountId);

    assertValidAdjustment({
      amountMinor: BigInt(input.amountMinor),
      direction: input.direction,
      reason: input.reason,
    });

    const nowIso = this.ctx.now().toISOString();

    return this.transactionsService.create(userId, {
      type: 'ADJUSTMENT',
      status: 'VALIDATED',
      accountId: account.id,
      amountMinor: input.amountMinor,
      currency: account.currency as 'XOF' | 'EUR' | 'USD' | 'GBP' | 'CAD',
      occurredAt: input.occurredAt ?? nowIso,
      valueDate: input.valueDate ?? nowIso.slice(0, 10),
      description: input.reason,
      adjustmentDirection: input.direction,
    });
  }

  async previewReconciliation(
    accountId: string,
    rawQuery: ReconciliationQuery,
  ): Promise<ReconciliationStatusResponse> {
    const query = ReconciliationQuerySchema.parse(rawQuery);
    const userId = this.ctx.userId();
    await this.getActiveAccount(userId, accountId);

    const statementDate = new Date(`${query.statementDate}T00:00:00.000Z`);
    const balanceInfo = await this.accountsRepo.getClearedBalance(userId, accountId, statementDate);
    if (!balanceInfo) {
      throw new DomainError('NOT_FOUND', 'Compte financier introuvable.');
    }

    const statementEndingMinor = BigInt(query.statementEndingBalanceMinor);
    const calc = calculateReconciliation(balanceInfo.clearedBalanceMinor, statementEndingMinor);

    return {
      accountId,
      statementDate: query.statementDate,
      statementEndingBalanceMinor: query.statementEndingBalanceMinor,
      clearedBalanceMinor: balanceInfo.clearedBalanceMinor.toString(),
      differenceMinor: calc.differenceMinor.toString(),
      isBalanced: calc.isBalanced,
      unreconciledCount: balanceInfo.unreconciledCount,
    };
  }

  private async applyAdjustmentIfNeeded(
    accountId: string,
    input: ConfirmReconciliation,
    adjustmentNeeded: { direction: 'CREDIT' | 'DEBIT'; amountMinor: bigint } | null,
  ): Promise<TransactionResponse | null> {
    if (!input.createAdjustmentIfNeeded || !adjustmentNeeded) {
      return null;
    }

    return this.adjust(accountId, {
      amountMinor: adjustmentNeeded.amountMinor.toString(),
      direction: adjustmentNeeded.direction,
      reason: input.adjustmentReason ?? 'Ajustement de rapprochement bancaire',
      valueDate: input.statementDate,
    });
  }

  async confirmReconciliation(
    accountId: string,
    rawInput: ConfirmReconciliation,
  ): Promise<ReconciliationResult> {
    const input = ConfirmReconciliationSchema.parse(rawInput);
    const userId = this.ctx.userId();
    await this.getActiveAccount(userId, accountId);

    const statementDate = new Date(`${input.statementDate}T00:00:00.000Z`);
    const balanceInfo = await this.accountsRepo.getClearedBalance(userId, accountId, statementDate);
    if (!balanceInfo) {
      throw new DomainError('NOT_FOUND', 'Compte financier introuvable.');
    }

    const statementEndingMinor = BigInt(input.statementEndingBalanceMinor);
    const calc = calculateReconciliation(balanceInfo.clearedBalanceMinor, statementEndingMinor);

    const adjustmentTransaction = await this.applyAdjustmentIfNeeded(accountId, input, calc.adjustmentNeeded);

    await this.audit.record({
      action: 'finance.reconciliation.confirm',
      userId,
      entityType: 'FinancialAccount',
      entityId: accountId,
      outcome: 'SUCCESS',
      metadata: {
        statementDate: input.statementDate,
        statementEndingBalanceMinor: input.statementEndingBalanceMinor,
        differenceMinor: calc.differenceMinor.toString(),
        adjusted: adjustmentTransaction !== null,
      },
    });

    const isBalanced = adjustmentTransaction !== null ? true : calc.isBalanced;
    const differenceMinor = adjustmentTransaction !== null ? '0' : calc.differenceMinor.toString();
    const clearedBalanceMinor =
      adjustmentTransaction !== null
        ? input.statementEndingBalanceMinor
        : balanceInfo.clearedBalanceMinor.toString();

    return {
      accountId,
      statementDate: input.statementDate,
      statementEndingBalanceMinor: input.statementEndingBalanceMinor,
      clearedBalanceMinor,
      differenceMinor,
      isBalanced,
      adjustmentTransaction,
    };
  }
}
