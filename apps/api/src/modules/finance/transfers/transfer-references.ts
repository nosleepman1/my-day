import { Injectable } from '@nestjs/common';
import type { FinancialAccount } from '@prisma/client';

import { DomainError } from '../../../platform/errors/domain-error';
import { AccountsRepository } from '../accounts/accounts.repository';
import { CategoriesRepository } from '../categories/categories.repository';

/** Validation des comptes et catégories système pour les transferts (FINANCE_RULES §6, §7). */
@Injectable()
export class TransferReferences {
  constructor(
    private readonly accounts: AccountsRepository,
    private readonly categories: CategoriesRepository,
  ) {}

  async requireAccount(userId: string, accountId: string): Promise<FinancialAccount> {
    const account = await this.accounts.findById(userId, accountId);
    if (!account) {
      throw new DomainError('NOT_FOUND', 'Compte financier introuvable.');
    }
    return account;
  }

  async findFeeCategoryId(userId: string): Promise<string | null> {
    const feeCategory = await this.categories.findBySystemKey(userId, 'EXPENSE_FEE');
    return feeCategory?.id ?? null;
  }
}
