import { http, HttpResponse } from 'msw';

import type {
  AccountResponse,
  BalancesReport,
  CategoryResponse,
  TransactionResponse,
} from '@orbit/contracts';

import { server } from './msw-server';

export const NOW = '2026-10-15T12:00:00.000Z';
export const ID = (n: number): string => `0192f3a4-5b6c-7d8e-9f02-0000000000${String(n).padStart(2, '0')}`;

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

function registerFinanceAuxRoutes(balances: BalancesReport, transactions: TransactionResponse[]): void {
  server.use(
    http.get('/api/v1/finance/reports/balances', () => HttpResponse.json({ data: balances })),
    http.get('/api/v1/finance/transactions', () =>
      HttpResponse.json({
        data: transactions,
        meta: { limit: 25, nextCursor: null, hasMore: false },
      }),
    ),
    http.get('/api/v1/finance/categories', () => HttpResponse.json({ data: [categoryFixture()] })),
    http.get('/api/v1/finance/counterparties', () =>
      HttpResponse.json({ data: [], meta: { limit: 25, nextCursor: null, hasMore: false } }),
    ),
  );
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
  const transactionsState = [...transactions];

  registerAccountRoutes(
    () => accountsState,
    (next) => {
      accountsState = next;
    },
  );
  registerFinanceAuxRoutes(balances, transactionsState);

  return {
    getAccounts: () => accountsState,
    getTransactions: () => transactionsState,
  };
}
