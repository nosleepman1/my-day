import { http, HttpResponse } from 'msw';

import type {
  AccountAdjustmentInput,
  AccountResponse,
  BalancesReport,
  CategoryResponse,
  ConfirmReconciliation,
  CounterpartyResponse,
  CreateCategory,
  CreateCounterparty,
  CreateTransactionInput,
  CreateTransferInput,
  TransactionResponse,
  TransferResponse,
} from '@orbit/contracts';

import { server } from './msw-server';

export const NOW = '2026-10-15T12:00:00.000Z';
export const ID = (n: number): string => `0192f3a4-5b6c-7d8e-9f02-${String(n).padStart(12, '0')}`;

export function accountFixture(overrides: Partial<AccountResponse> = {}): AccountResponse {
  return {
    id: ID(1),
    name: 'Wave Principal',
    type: 'MOBILE_MONEY',
    provider: 'Wave',
    currency: 'XOF',
    currentBalanceMinor: '150000',
    openingBalanceMinor: '50000',
    openedOn: '2026-01-01',
    allowOverdraft: false,
    overdraftLimitMinor: null,
    includeInNetWorth: true,
    color: '#00ccff',
    icon: null,
    notes: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function transactionFixture(overrides: Partial<TransactionResponse> = {}): TransactionResponse {
  return {
    id: ID(10),
    type: 'EXPENSE',
    status: 'VALIDATED',
    economicClass: 'EXPENSE_OPERATING',
    amountMinor: '15000',
    currency: 'XOF',
    occurredAt: NOW,
    valueDate: '2026-10-15',
    source: 'MANUAL',
    description: 'Courses alimentation',
    notes: null,
    categoryId: ID(20),
    counterpartyId: null,
    transferId: null,
    cancelReason: null,
    cancelledAt: null,
    ledgerEntries: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function categoryFixture(overrides: Partial<CategoryResponse> = {}): CategoryResponse {
  return {
    id: ID(20),
    name: 'Alimentation',
    kind: 'EXPENSE',
    defaultEconomicClass: 'EXPENSE_OPERATING',
    parentId: null,
    icon: null,
    color: '#ffaa00',
    isSystem: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function counterpartyFixture(overrides: Partial<CounterpartyResponse> = {}): CounterpartyResponse {
  return {
    id: ID(30),
    name: 'Auchan Supermarché',
    kind: 'ORGANIZATION',
    phone: null,
    email: null,
    notes: 'Alimentation générale',
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function balancesFixture(overrides: Partial<BalancesReport> = {}): BalancesReport {
  return {
    asOf: '2026-10-15',
    accounts: [
      {
        accountId: ID(1),
        name: 'Wave Principal',
        type: 'MOBILE_MONEY',
        currency: 'XOF',
        balanceMinor: '150000',
        isArchived: false,
      },
    ],
    totalsByCurrency: {
      XOF: '150000',
    },
    ...overrides,
  };
}

function registerAccountRoutes(
  getAccounts: () => AccountResponse[],
  setAccounts: (accs: AccountResponse[]) => void,
): void {
  server.use(
    http.get('/api/v1/finance/accounts', () => HttpResponse.json({ data: getAccounts() })),
    http.get('/api/v1/finance/accounts/:id', ({ params }) => {
      const id = params['id'];
      const found = getAccounts().find((a) => a.id === id);
      if (!found) return new HttpResponse(null, { status: 404 });
      return HttpResponse.json({ data: found });
    }),
    http.post('/api/v1/finance/accounts', async ({ request }) => {
      const body = (await request.json()) as Partial<AccountResponse>;
      const current = getAccounts();
      const newAcc = accountFixture({
        id: ID(current.length + 1),
        ...body,
        currentBalanceMinor: body.openingBalanceMinor ?? '0',
      });
      setAccounts([...current, newAcc]);
      return HttpResponse.json({ data: newAcc }, { status: 201 });
    }),
    http.post('/api/v1/finance/accounts/:id/close', ({ params }) => {
      const id = params['id'];
      const updated = getAccounts().map((a) => (a.id === id ? { ...a, archivedAt: NOW } : a));
      setAccounts(updated);
      return HttpResponse.json({ data: updated.find((a) => a.id === id) });
    }),
    http.post('/api/v1/finance/accounts/:id/reopen', ({ params }) => {
      const id = params['id'];
      const updated = getAccounts().map((a) => (a.id === id ? { ...a, archivedAt: null } : a));
      setAccounts(updated);
      return HttpResponse.json({ data: updated.find((a) => a.id === id) });
    }),
  );
}

function registerTransactionListAndGet(getTransactions: () => TransactionResponse[]): void {
  server.use(
    http.get('/api/v1/finance/transactions', () =>
      HttpResponse.json({
        data: getTransactions(),
        meta: { limit: 25, nextCursor: null, hasMore: false },
      }),
    ),
    http.get('/api/v1/finance/transactions/:id', ({ params }) => {
      const id = params['id'];
      const found = getTransactions().find((t) => t.id === id);
      if (!found) return new HttpResponse(null, { status: 404 });
      return HttpResponse.json({ data: found });
    }),
  );
}

function registerTransactionMutations(
  getTransactions: () => TransactionResponse[],
  setTransactions: (txs: TransactionResponse[]) => void,
): void {
  server.use(
    http.post('/api/v1/finance/transactions', async ({ request }) => {
      const body = (await request.json()) as CreateTransactionInput;
      const current = getTransactions();
      const defaultEconomicClass = body.type === 'INCOME' ? 'INCOME_OPERATING' : 'EXPENSE_OPERATING';
      const newTx = transactionFixture({
        id: ID(current.length + 10),
        type: body.type,
        amountMinor: body.amountMinor,
        currency: body.currency,
        occurredAt: body.occurredAt,
        valueDate: body.valueDate,
        description: body.description ?? null,
        notes: body.notes ?? null,
        categoryId: body.categoryId ?? null,
        counterpartyId: body.counterpartyId ?? null,
        economicClass: body.economicClass ?? defaultEconomicClass,
        status: body.status ?? 'VALIDATED',
      });
      setTransactions([...current, newTx]);
      return HttpResponse.json({ data: newTx }, { status: 201 });
    }),
    http.post('/api/v1/finance/transactions/:id/validate', ({ params }) => {
      const id = params['id'];
      const updated = getTransactions().map((t) =>
        t.id === id ? { ...t, status: 'VALIDATED' as const } : t,
      );
      setTransactions(updated);
      return HttpResponse.json({ data: updated.find((t) => t.id === id) });
    }),
    http.post('/api/v1/finance/transactions/:id/cancel', async ({ params, request }) => {
      const id = params['id'];
      const body = (await request.json()) as { reason: string };
      const updated = getTransactions().map((t) =>
        t.id === id ? { ...t, status: 'CANCELLED' as const, cancelReason: body.reason, cancelledAt: NOW } : t,
      );
      setTransactions(updated);
      return HttpResponse.json({ data: updated.find((t) => t.id === id) });
    }),
  );
}

function registerTransferMutation(
  getTransactions: () => TransactionResponse[],
  setTransactions: (txs: TransactionResponse[]) => void,
): void {
  server.use(
    http.post('/api/v1/finance/transfers', async ({ request }) => {
      const body = (await request.json()) as CreateTransferInput;
      const current = getTransactions();
      const newTx = transactionFixture({
        id: ID(current.length + 10),
        type: 'TRANSFER',
        amountMinor: body.fromAmountMinor,
        description: body.description ?? 'Transfert',
      });
      setTransactions([...current, newTx]);
      const res: TransferResponse = {
        id: ID(99),
        fromAccountId: body.fromAccountId,
        toAccountId: body.toAccountId,
        fromAmountMinor: body.fromAmountMinor,
        toAmountMinor: body.toAmountMinor ?? body.fromAmountMinor,
        fromCurrency: 'XOF',
        toCurrency: 'XOF',
        exchangeRate: body.exchangeRate ?? null,
        rateDate: body.rateDate ?? null,
        transaction: newTx,
      };
      return HttpResponse.json({ data: res }, { status: 201 });
    }),
  );
}

function registerSummaryAndBalancesRoutes(balances: BalancesReport): void {
  server.use(
    http.get('/api/v1/finance/reports/balances', () => HttpResponse.json({ data: balances })),
    http.get('/api/v1/finance/reports/summary', () =>
      HttpResponse.json({
        data: {
          period: { from: '2026-10-01', to: '2026-10-31' },
          summaries: [
            {
              currency: 'XOF',
              incomeMinor: '500000',
              expenseMinor: '200000',
              netMinor: '300000',
              otherIncomeMinor: '0',
              adjustmentsMinor: '0',
            },
          ],
        },
      }),
    ),
  );
}

function registerBreakdownAndCashflowRoutes(): void {
  server.use(
    http.get('/api/v1/finance/reports/by-category', () =>
      HttpResponse.json({
        data: {
          period: { fromDate: '2026-10-01', toDate: '2026-10-31' },
          currency: 'XOF',
          kind: 'EXPENSE',
          totalMinor: '200000',
          categories: [
            {
              categoryId: ID(20),
              categoryName: 'Alimentation',
              amountMinor: '200000',
              percentage: 100,
            },
          ],
        },
      }),
    ),
    http.get('/api/v1/finance/reports/cashflow', () =>
      HttpResponse.json({
        data: {
          period: { fromDate: '2026-01-01', toDate: '2026-12-31' },
          currency: 'XOF',
          totalIncomeMinor: '500000',
          totalExpenseMinor: '200000',
          netCashFlowMinor: '300000',
          byEconomicClass: {},
          byMonth: [{ month: '2026-10', incomeMinor: '500000', expenseMinor: '200000', netMinor: '300000' }],
        },
      }),
    ),
  );
}

function registerCategoryAndCounterpartyRoutes(): void {
  const categoriesState = [categoryFixture()];
  const counterpartiesState = [counterpartyFixture()];

  server.use(
    http.get('/api/v1/finance/categories', () => HttpResponse.json({ data: categoriesState })),
    http.post('/api/v1/finance/categories', async ({ request }) => {
      const body = (await request.json()) as CreateCategory;
      const newCat = categoryFixture({
        id: ID(categoriesState.length + 20),
        name: body.name,
        kind: body.kind,
        defaultEconomicClass: body.defaultEconomicClass,
        color: body.color ?? null,
        isSystem: false,
      });
      categoriesState.push(newCat);
      return HttpResponse.json({ data: newCat }, { status: 201 });
    }),
    http.get('/api/v1/finance/counterparties', () =>
      HttpResponse.json({
        data: counterpartiesState,
        meta: { limit: 25, nextCursor: null, hasMore: false },
      }),
    ),
    http.post('/api/v1/finance/counterparties', async ({ request }) => {
      const body = (await request.json()) as CreateCounterparty;
      const newCp = counterpartyFixture({
        id: ID(counterpartiesState.length + 30),
        name: body.name,
        kind: body.kind,
        notes: body.notes ?? null,
      });
      counterpartiesState.push(newCp);
      return HttpResponse.json({ data: newCp }, { status: 201 });
    }),
  );
}

function registerAdjustmentAndReconciliationRoutes(): void {
  server.use(
    http.post('/api/v1/finance/accounts/:id/adjustments', async ({ request }) => {
      const body = (await request.json()) as AccountAdjustmentInput;
      return HttpResponse.json(
        {
          data: transactionFixture({
            type: 'ADJUSTMENT',
            amountMinor: body.amountMinor,
            description: body.reason,
          }),
        },
        { status: 201 },
      );
    }),
    http.get('/api/v1/finance/accounts/:id/reconciliations', ({ params }) =>
      HttpResponse.json({
        data: {
          accountId: params['id'],
          statementDate: '2026-10-15',
          statementEndingBalanceMinor: '150000',
          clearedBalanceMinor: '150000',
          differenceMinor: '0',
          isBalanced: true,
          unreconciledCount: 0,
        },
      }),
    ),
    http.post('/api/v1/finance/accounts/:id/reconciliations', async ({ params, request }) => {
      const body = (await request.json()) as ConfirmReconciliation;
      return HttpResponse.json(
        {
          data: {
            accountId: params['id'],
            statementDate: body.statementDate,
            statementEndingBalanceMinor: body.statementEndingBalanceMinor,
            clearedBalanceMinor: body.statementEndingBalanceMinor,
            differenceMinor: '0',
            isBalanced: true,
            adjustmentTransaction: null,
          },
        },
        { status: 201 },
      );
    }),
  );
}

function registerFinanceAuxRoutes(balances: BalancesReport): void {
  registerSummaryAndBalancesRoutes(balances);
  registerBreakdownAndCashflowRoutes();
  registerCategoryAndCounterpartyRoutes();
  registerAdjustmentAndReconciliationRoutes();
}

export function mockFinanceEndpoints({
  accounts = [accountFixture()],
  transactions = [transactionFixture()],
  balances = balancesFixture(),
}: {
  accounts?: AccountResponse[];
  transactions?: TransactionResponse[];
  balances?: BalancesReport;
} = {}): {
  getAccounts: () => AccountResponse[];
  getTransactions: () => TransactionResponse[];
} {
  let accountsState = [...accounts];
  let transactionsState = [...transactions];

  registerAccountRoutes(
    () => accountsState,
    (next) => {
      accountsState = next;
    },
  );
  registerTransactionListAndGet(() => transactionsState);
  registerTransactionMutations(
    () => transactionsState,
    (next) => {
      transactionsState = next;
    },
  );
  registerTransferMutation(
    () => transactionsState,
    (next) => {
      transactionsState = next;
    },
  );
  registerFinanceAuxRoutes(balances);

  return {
    getAccounts: () => accountsState,
    getTransactions: () => transactionsState,
  };
}
