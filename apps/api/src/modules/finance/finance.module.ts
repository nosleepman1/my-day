import { Module } from '@nestjs/common';

import { AccountsController } from './accounts/accounts.controller';
import { AccountsRepository } from './accounts/accounts.repository';
import { AccountsService } from './accounts/accounts.service';
import { FinanceContext } from './shared/finance-context';

/** M04 Finance (PHASE-05) : comptes, catégories, contreparties, transactions, grand livre. */
@Module({
  controllers: [AccountsController],
  providers: [FinanceContext, AccountsRepository, AccountsService],
  exports: [FinanceContext, AccountsRepository, AccountsService],
})
export class FinanceModule {}
