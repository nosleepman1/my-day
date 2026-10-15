import { Module } from '@nestjs/common';

import { AccountsController } from './accounts/accounts.controller';
import { AccountsRepository } from './accounts/accounts.repository';
import { AccountsService } from './accounts/accounts.service';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesRepository } from './categories/categories.repository';
import { CategoriesService } from './categories/categories.service';
import { FinanceContext } from './shared/finance-context';

/** M04 Finance (PHASE-05) : comptes, catégories, contreparties, transactions, grand livre. */
@Module({
  controllers: [AccountsController, CategoriesController],
  providers: [FinanceContext, AccountsRepository, AccountsService, CategoriesRepository, CategoriesService],
  exports: [FinanceContext, AccountsRepository, AccountsService, CategoriesRepository, CategoriesService],
})
export class FinanceModule {}
