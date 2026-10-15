import { Injectable } from '@nestjs/common';

import type { TransactionType } from '@orbit/contracts';

import { DomainError } from '../../../platform/errors/domain-error';
import { CategoriesRepository } from '../categories/categories.repository';
import { CounterpartiesRepository } from '../counterparties/counterparties.repository';
import { assertCategoryMatchesType } from '../domain/economic-classification';

/** Validation des références de catégories et contreparties (FINANCE_RULES §4.1). */
@Injectable()
export class TransactionReferences {
  constructor(
    private readonly categories: CategoriesRepository,
    private readonly counterparties: CounterpartiesRepository,
  ) {}

  async validateCategory(userId: string, categoryId: string, type: TransactionType): Promise<string> {
    const category = await this.categories.findById(userId, categoryId);
    if (!category) {
      throw new DomainError('NOT_FOUND', 'Catégorie introuvable.');
    }
    assertCategoryMatchesType(category.kind, type);
    return category.defaultEconomicClass;
  }

  async validateCounterparty(userId: string, counterpartyId: string): Promise<void> {
    const counterparty = await this.counterparties.findById(userId, counterpartyId);
    if (!counterparty) {
      throw new DomainError('NOT_FOUND', 'Contrepartie introuvable.');
    }
  }
}
