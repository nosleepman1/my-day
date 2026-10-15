import { Module } from '@nestjs/common';

import { AccountsController } from './accounts/accounts.controller';
import { AccountsRepository } from './accounts/accounts.repository';
import { AccountsService } from './accounts/accounts.service';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesRepository } from './categories/categories.repository';
import { CategoriesService } from './categories/categories.service';
import { CounterpartiesController } from './counterparties/counterparties.controller';
import { CounterpartiesRepository } from './counterparties/counterparties.repository';
import { CounterpartiesService } from './counterparties/counterparties.service';
import { FinanceContext } from './shared/finance-context';

/** M04 Finance (PHASE-05) : comptes, catégories, contreparties, transactions, grand livre. */
@Module({
  controllers: [AccountsController, CategoriesController, CounterpartiesController],
  providers: [
    FinanceContext,
    AccountsRepository,
    AccountsService,
    CategoriesRepository,
    CategoriesService,
    CounterpartiesRepository,
    CounterpartiesService,
  ],
  exports: [
    FinanceContext,
    AccountsRepository,
    AccountsService,
    CategoriesRepository,
    CategoriesService,
    CounterpartiesRepository,
    CounterpartiesService,
  ],
})
export class FinanceModule {}
