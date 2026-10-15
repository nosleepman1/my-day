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
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { FinanceContext } from './shared/finance-context';
import { TransactionReferences } from './transactions/transaction-references';
import { TransactionsController } from './transactions/transactions.controller';
import { TransactionsRepository } from './transactions/transactions.repository';
import { TransactionsService } from './transactions/transactions.service';
import { TransferReferences } from './transfers/transfer-references';
import { TransfersController } from './transfers/transfers.controller';
import { TransfersRepository } from './transfers/transfers.repository';
import { TransfersService } from './transfers/transfers.service';

/** M04 Finance (PHASE-05) : comptes, catégories, contreparties, transactions, grand livre. */
@Module({
  controllers: [
    AccountsController,
    CategoriesController,
    CounterpartiesController,
    TransactionsController,
    TransfersController,
  ],
  providers: [
    FinanceContext,
    AccountsRepository,
    AccountsService,
    CategoriesRepository,
    CategoriesService,
    CounterpartiesRepository,
    CounterpartiesService,
    ReconciliationService,
    TransactionReferences,
    TransactionsRepository,
    TransactionsService,
    TransferReferences,
    TransfersRepository,
    TransfersService,
  ],
  exports: [
    FinanceContext,
    AccountsRepository,
    AccountsService,
    CategoriesRepository,
    CategoriesService,
    CounterpartiesRepository,
    CounterpartiesService,
    ReconciliationService,
    TransactionReferences,
    TransactionsRepository,
    TransactionsService,
    TransferReferences,
    TransfersRepository,
    TransfersService,
  ],
})
export class FinanceModule {}
