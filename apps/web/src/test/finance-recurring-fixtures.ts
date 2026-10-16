import { http, HttpResponse } from 'msw';

import type {
  ConfirmOccurrenceInput,
  CreateRecurringTransactionInput,
  ForecastReportResponse,
  RecurringOccurrenceResponse,
  RecurringTransactionResponse,
  UpdateRecurringTransaction,
} from '@orbit/contracts';

import { ID, NOW } from './finance-fixtures';
import { server } from './msw-server';

export function recurringFixture(
  overrides: Partial<RecurringTransactionResponse> = {},
): RecurringTransactionResponse {
  return {
    id: ID(100),
    userId: ID(999),
    name: 'Abonnement Cloud',
    type: 'EXPENSE',
    economicClass: 'EXPENSE_OPERATING',
    amountMinor: '5000',
    currency: 'XOF',
    accountId: ID(1),
    destinationAccountId: null,
    categoryId: ID(20),
    counterpartyId: null,
    projectId: null,
    generationMode: 'CONFIRM',
    reminderDaysBefore: 1,
    status: 'ACTIVE',
    recurrenceRule: 'FREQ=MONTHLY;INTERVAL=1',
    recurrenceAnchorOn: '2026-01-01',
    recurrenceTimezone: 'Africa/Dakar',
    recurrenceLocalTime: '08:00',
    nextOccurrenceAt: '2026-11-01T08:00:00.000Z',
    generatedUntil: '2026-12-01',
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function occurrenceFixture(
  overrides: Partial<RecurringOccurrenceResponse> = {},
): RecurringOccurrenceResponse {
  return {
    id: ID(200),
    userId: ID(999),
    recurringTransactionId: ID(100),
    dueOn: '2026-10-15',
    expectedAmountMinor: '5000',
    currency: 'XOF',
    status: 'EXPECTED',
    transactionId: null,
    confirmedAt: null,
    skippedAt: null,
    createdAt: NOW,
    isOverdue: false,
    recurringTransaction: {
      id: ID(100),
      name: 'Abonnement Cloud',
      type: 'EXPENSE',
      economicClass: 'EXPENSE_OPERATING',
      accountId: ID(1),
    },
    ...overrides,
  };
}

export function forecastFixture(overrides: Partial<ForecastReportResponse> = {}): ForecastReportResponse {
  return {
    horizonDays: 90,
    startDate: '2026-10-15',
    endDate: '2027-01-13',
    accounts: [
      {
        accountId: ID(1),
        accountName: 'Wave Principal',
        currency: 'XOF',
        currentBalanceMinor: '150000',
        projectedEndBalanceMinor: '135000',
        lowestProjectedBalanceMinor: '120000',
        hasProjectedNegative: false,
        points: [
          {
            date: '2026-10-15',
            realisedBalanceMinor: '150000',
            projectedBalanceMinor: '150000',
            expectedInflowsMinor: '0',
            expectedOutflowsMinor: '0',
          },
          {
            date: '2026-11-01',
            realisedBalanceMinor: null,
            projectedBalanceMinor: '145000',
            expectedInflowsMinor: '0',
            expectedOutflowsMinor: '5000',
          },
          {
            date: '2026-12-01',
            realisedBalanceMinor: null,
            projectedBalanceMinor: '140000',
            expectedInflowsMinor: '0',
            expectedOutflowsMinor: '5000',
          },
        ],
      },
    ],
    occurrences: [occurrenceFixture()],
    debts: [],
    ...overrides,
  };
}

interface RecurringRouteState {
  getRecurring: () => RecurringTransactionResponse[];
  setRecurring: (items: RecurringTransactionResponse[]) => void;
  getOccurrences: () => RecurringOccurrenceResponse[];
  setOccurrences: (items: RecurringOccurrenceResponse[]) => void;
}

function registerRecurringReadRoutes(state: RecurringRouteState): void {
  server.use(
    http.get('/api/v1/finance/recurring', ({ request }) => {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      let items = state.getRecurring();
      if (status) items = items.filter((r) => r.status === status);
      return HttpResponse.json({
        data: items,
        meta: { limit: 25, nextCursor: null, hasMore: false },
      });
    }),
    http.get('/api/v1/finance/recurring/:id', ({ params }) => {
      const found = state.getRecurring().find((r) => r.id === params['id']);
      if (!found) return new HttpResponse(null, { status: 404 });
      return HttpResponse.json({ data: found });
    }),
  );
}

function registerRecurringMutationRoutes(state: RecurringRouteState): void {
  server.use(
    http.post('/api/v1/finance/recurring', async ({ request }) => {
      const body = (await request.json()) as CreateRecurringTransactionInput;
      const current = state.getRecurring();
      const newRec = recurringFixture({
        id: ID(current.length + 101),
        name: body.name,
        type: body.type,
        amountMinor: body.amountMinor,
        currency: body.currency,
        accountId: body.accountId,
        destinationAccountId: body.destinationAccountId ?? null,
        categoryId: body.categoryId ?? null,
        counterpartyId: body.counterpartyId ?? null,
        projectId: body.projectId ?? null,
        recurrenceRule: body.recurrenceRule,
        recurrenceAnchorOn: body.recurrenceAnchorOn,
        recurrenceTimezone: body.recurrenceTimezone,
        notes: body.notes ?? null,
        status: 'ACTIVE',
      });
      state.setRecurring([...current, newRec]);
      return HttpResponse.json({ data: newRec }, { status: 201 });
    }),
    http.patch('/api/v1/finance/recurring/:id', async ({ params, request }) => {
      const body = (await request.json()) as UpdateRecurringTransaction;
      const current = state.getRecurring();
      const updated = current.map((r) => {
        if (r.id !== params['id']) return r;
        const definedEntries = Object.entries(body).filter(([, v]) => v !== undefined);
        return { ...r, ...Object.fromEntries(definedEntries) };
      });
      state.setRecurring(updated);
      return HttpResponse.json({ data: updated.find((r) => r.id === params['id']) });
    }),
  );
}

function registerRecurringLifecycleRoutes(state: RecurringRouteState): void {
  server.use(
    http.post('/api/v1/finance/recurring/:id/pause', ({ params }) => {
      const current = state.getRecurring();
      const updated = current.map((r) => (r.id === params['id'] ? { ...r, status: 'PAUSED' as const } : r));
      state.setRecurring(updated);
      return HttpResponse.json({ data: updated.find((r) => r.id === params['id']) });
    }),
    http.post('/api/v1/finance/recurring/:id/resume', ({ params }) => {
      const current = state.getRecurring();
      const updated = current.map((r) => (r.id === params['id'] ? { ...r, status: 'ACTIVE' as const } : r));
      state.setRecurring(updated);
      return HttpResponse.json({ data: updated.find((r) => r.id === params['id']) });
    }),
  );
}

function registerRecurringCrudRoutes(state: RecurringRouteState): void {
  registerRecurringReadRoutes(state);
  registerRecurringMutationRoutes(state);
  registerRecurringLifecycleRoutes(state);
}

function registerOccurrenceRoutes(state: RecurringRouteState): void {
  server.use(
    http.get('/api/v1/finance/recurring/:id/occurrences', ({ params }) => {
      const items = state.getOccurrences().filter((o) => o.recurringTransactionId === params['id']);
      return HttpResponse.json({
        data: items,
        meta: { limit: items.length || 1, nextCursor: null, hasMore: false },
      });
    }),
    http.get('/api/v1/finance/recurring/occurrences', ({ request }) => {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      let items = state.getOccurrences();
      if (status) items = items.filter((o) => o.status === status);
      return HttpResponse.json({
        data: items,
        meta: { limit: items.length || 1, nextCursor: null, hasMore: false },
      });
    }),
    http.post('/api/v1/finance/recurring/occurrences/:id/confirm', async ({ params, request }) => {
      const body = (await request.json()) as ConfirmOccurrenceInput;
      const current = state.getOccurrences();
      const updated = current.map((o) =>
        o.id === params['id']
          ? {
              ...o,
              status: 'CONFIRMED' as const,
              confirmedAt: NOW,
              transactionId: body.transactionId ?? ID(99),
            }
          : o,
      );
      state.setOccurrences(updated);
      return HttpResponse.json({ data: updated.find((o) => o.id === params['id']) });
    }),
    http.post('/api/v1/finance/recurring/occurrences/:id/skip', ({ params }) => {
      const current = state.getOccurrences();
      const updated = current.map((o) =>
        o.id === params['id'] ? { ...o, status: 'SKIPPED' as const, skippedAt: NOW } : o,
      );
      state.setOccurrences(updated);
      return HttpResponse.json({ data: updated.find((o) => o.id === params['id']) });
    }),
  );
}

function registerForecastRoutes(getForecast: () => ForecastReportResponse): void {
  server.use(
    http.get('/api/v1/finance/reports/forecast', () => {
      return HttpResponse.json({ data: getForecast() });
    }),
  );
}

export function mockRecurringAndForecastEndpoints({
  recurring = [recurringFixture()],
  occurrences = [occurrenceFixture()],
  forecast = forecastFixture(),
}: {
  recurring?: RecurringTransactionResponse[];
  occurrences?: RecurringOccurrenceResponse[];
  forecast?: ForecastReportResponse;
} = {}): {
  getRecurring: () => RecurringTransactionResponse[];
  getOccurrences: () => RecurringOccurrenceResponse[];
  getForecast: () => ForecastReportResponse;
} {
  let recurringState = [...recurring];
  let occurrencesState = [...occurrences];
  const forecastState = { ...forecast };

  const state: RecurringRouteState = {
    getRecurring: () => recurringState,
    setRecurring: (items) => {
      recurringState = items;
    },
    getOccurrences: () => occurrencesState,
    setOccurrences: (items) => {
      occurrencesState = items;
    },
  };

  registerRecurringCrudRoutes(state);
  registerOccurrenceRoutes(state);
  registerForecastRoutes(() => forecastState);

  return {
    getRecurring: () => recurringState,
    getOccurrences: () => occurrencesState,
    getForecast: () => forecastState,
  };
}
