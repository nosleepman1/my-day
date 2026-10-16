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
import { DebtsController } from './debts/debts.controller';
import { DebtsRepository } from './debts/debts.repository';
import { DebtsService } from './debts/debts.service';
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { RecurringController } from './recurring/recurring.controller';
import { RecurringRepository } from './recurring/recurring.repository';
import { RecurringService } from './recurring/recurring.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { FinanceContext } from './shared/finance-context';
import { TransactionReferences } from './transactions/transaction-references';
import { TransactionsController } from './transactions/transactions.controller';
import { TransactionsRepository } from './transactions/transactions.repository';
import { TransactionsService } from './transactions/transactions.service';
import { TransferReferences } from './transfers/transfer-references';
import { TransfersController } from './transfers/transfers.controller';
import { TransfersRepository } from './transfers/transfers.repository';
import { TransfersService } from './transfers/transfers.service';

/** M04 Finance (PHASE-05, PHASE-06) : comptes, catégories, contreparties, transactions, dettes, récurrences. */
@Module({
  controllers: [
    AccountsController,
    CategoriesController,
    CounterpartiesController,
    DebtsController,
    RecurringController,
    ReportsController,
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
    DebtsRepository,
    DebtsService,
    ReconciliationService,
    RecurringRepository,
    RecurringService,
    ReportsService,
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
    DebtsRepository,
    DebtsService,
    ReconciliationService,
    RecurringRepository,
    RecurringService,
    ReportsService,
    TransactionReferences,
    TransactionsRepository,
    TransactionsService,
    TransferReferences,
    TransfersRepository,
    TransfersService,
  ],
})
export class FinanceModule {}
