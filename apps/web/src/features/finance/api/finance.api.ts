import { z } from 'zod';

import {
  AccountAdjustmentSchema,
  AccountEnvelopeSchema,
  AccountListEnvelopeSchema,
  BalancesReportEnvelopeSchema,
  CancelDebtSchema,
  CancelTransactionSchema,
  CashFlowEnvelopeSchema,
  CategoryBreakdownEnvelopeSchema,
  CategoryEnvelopeSchema,
  CategoryListEnvelopeSchema,
  CloseAccountSchema,
  ConfirmOccurrenceSchema,
  ConfirmReconciliationSchema,
  CounterpartyEnvelopeSchema,
  CounterpartyListEnvelopeSchema,
  CreateAccountSchema,
  CreateCategorySchema,
  CreateCounterpartySchema,
  CreateDebtSchema,
  CreateRecurringTransactionSchema,
  CreateRepaymentSchema,
  CreateTransactionSchema,
  CreateTransferSchema,
  DebtEnvelopeSchema,
  DebtListEnvelopeSchema,
  DebtSummaryEnvelopeSchema,
  FinanceSummaryEnvelopeSchema,
  ForecastReportEnvelopeSchema,
  ReconciliationResultEnvelopeSchema,
  ReconciliationStatusEnvelopeSchema,
  RecurringOccurrenceEnvelopeSchema,
  RecurringOccurrenceListEnvelopeSchema,
  RecurringTransactionEnvelopeSchema,
  RecurringTransactionListEnvelopeSchema,
  ReopenAccountSchema,
  RepaymentEnvelopeSchema,
  RepaymentListEnvelopeSchema,
  SkipOccurrenceSchema,
  TransactionEnvelopeSchema,
  TransactionListEnvelopeSchema,
  TransferEnvelopeSchema,
  UpdateAccountSchema,
  UpdateCategorySchema,
  UpdateCounterpartySchema,
  UpdateDebtSchema,
  UpdateRecurringTransactionSchema,
  UpdateTransactionDetailsSchema,
  WriteOffDebtSchema,
  type AccountAdjustmentInput,
  type AccountEnvelope,
  type AccountListEnvelope,
  type BalancesReportEnvelope,
  type BalancesReportQuery,
  type CancelDebtInput,
  type CancelTransaction,
  type CashFlowEnvelope,
  type CashFlowQuery,
  type CategoryBreakdownEnvelope,
  type CategoryBreakdownQuery,
  type CategoryEnvelope,
  type CategoryListEnvelope,
  type ConfirmOccurrenceInput,
  type ConfirmReconciliation,
  type CounterpartyEnvelope,
  type CounterpartyListEnvelope,
  type CreateAccountInput,
  type CreateCategory,
  type CreateCounterparty,
  type CreateDebtInput,
  type CreateRecurringTransactionInput,
  type CreateRepaymentInput,
  type CreateTransactionInput,
  type CreateTransferInput,
  type DebtEnvelope,
  type DebtListEnvelope,
  type DebtSummaryEnvelope,
  type FinanceSummaryEnvelope,
  type FinanceSummaryQuery,
  type ForecastQuery,
  type ForecastReportEnvelope,
  type ListAccountsQuery,
  type ListCategoriesQuery,
  type ListCounterpartiesQuery,
  type ListDebtsQuery,
  type ListOccurrencesQuery,
  type ListRecurringTransactionsQuery,
  type ListTransactionsQuery,
  type ReconciliationQuery,
  type ReconciliationResultEnvelope,
  type ReconciliationStatusEnvelope,
  type RecurringOccurrenceEnvelope,
  type RecurringOccurrenceListEnvelope,
  type RecurringTransactionEnvelope,
  type RecurringTransactionListEnvelope,
  type RepaymentEnvelope,
  type RepaymentListEnvelope,
  type SkipOccurrenceInput,
  type TransactionEnvelope,
  type TransactionListEnvelope,
  type TransferEnvelope,
  type UpdateAccount,
  type UpdateCategory,
  type UpdateCounterparty,
  type UpdateDebt,
  type UpdateRecurringTransaction,
  type UpdateTransactionDetails,
  type WriteOffDebtInput,
} from '@orbit/contracts';

import { http, type RequestOptions } from '@/lib/http/client';

export type ListParams = Readonly<Record<string, string | number | boolean | undefined>>;

/** Convertit les paramètres en chaîne de requête URL en ignorant les valeurs vides ou indéfinies. */
export function queryString(params?: ListParams): string {
  if (params === undefined) return '';
  const entries = Object.entries(params)
    .filter(
      (entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== '',
    )
    .map(([key, val]) => [key, String(val)]);
  return entries.length === 0 ? '' : `?${new URLSearchParams(entries).toString()}`;
}

const signalOf = (signal?: AbortSignal): RequestOptions => (signal === undefined ? {} : { signal });
const NoContent = z.undefined();

export const financeApi = {
  // --- Comptes ---
  listAccounts: (params?: Partial<ListAccountsQuery>, signal?: AbortSignal): Promise<AccountListEnvelope> =>
    http(
      `/finance/accounts${queryString(params as ListParams)}`,
      AccountListEnvelopeSchema,
      signalOf(signal),
    ),

  account: (id: string, signal?: AbortSignal): Promise<AccountEnvelope> =>
    http(`/finance/accounts/${id}`, AccountEnvelopeSchema, signalOf(signal)),

  createAccount: (body: CreateAccountInput, idempotencyKey: string): Promise<AccountEnvelope> => {
    const validBody = CreateAccountSchema.parse(body);
    return http('/finance/accounts', AccountEnvelopeSchema, {
      method: 'POST',
      body: validBody,
      idempotencyKey,
    });
  },

  updateAccount: (id: string, body: UpdateAccount): Promise<AccountEnvelope> => {
    const validBody = UpdateAccountSchema.parse(body);
    return http(`/finance/accounts/${id}`, AccountEnvelopeSchema, { method: 'PATCH', body: validBody });
  },

  closeAccount: (id: string, notes?: string): Promise<AccountEnvelope> => {
    const validBody = CloseAccountSchema.parse({ notes });
    return http(`/finance/accounts/${id}/close`, AccountEnvelopeSchema, {
      method: 'POST',
      body: validBody,
    });
  },

  reopenAccount: (id: string, notes?: string): Promise<AccountEnvelope> => {
    const validBody = ReopenAccountSchema.parse({ notes });
    return http(`/finance/accounts/${id}/reopen`, AccountEnvelopeSchema, {
      method: 'POST',
      body: validBody,
    });
  },

  adjustAccount: (
    id: string,
    body: AccountAdjustmentInput,
    idempotencyKey: string,
  ): Promise<TransactionEnvelope> => {
    const validBody = AccountAdjustmentSchema.parse(body);
    return http(`/finance/accounts/${id}/adjustments`, TransactionEnvelopeSchema, {
      method: 'POST',
      body: validBody,
      idempotencyKey,
    });
  },

  reconciliationPreview: (
    id: string,
    query: ReconciliationQuery,
    signal?: AbortSignal,
  ): Promise<ReconciliationStatusEnvelope> =>
    http(
      `/finance/accounts/${id}/reconciliations${queryString(query as unknown as ListParams)}`,
      ReconciliationStatusEnvelopeSchema,
      signalOf(signal),
    ),

  confirmReconciliation: (
    id: string,
    body: ConfirmReconciliation,
    idempotencyKey: string,
  ): Promise<ReconciliationResultEnvelope> => {
    const validBody = ConfirmReconciliationSchema.parse(body);
    return http(`/finance/accounts/${id}/reconciliations`, ReconciliationResultEnvelopeSchema, {
      method: 'POST',
      body: validBody,
      idempotencyKey,
    });
  },

  // --- Catégories ---
  categories: (params?: Partial<ListCategoriesQuery>, signal?: AbortSignal): Promise<CategoryListEnvelope> =>
    http(
      `/finance/categories${queryString(params as unknown as ListParams)}`,
      CategoryListEnvelopeSchema,
      signalOf(signal),
    ),

  createCategory: (body: CreateCategory): Promise<CategoryEnvelope> => {
    const validBody = CreateCategorySchema.parse(body);
    return http('/finance/categories', CategoryEnvelopeSchema, { method: 'POST', body: validBody });
  },

  updateCategory: (id: string, body: UpdateCategory): Promise<CategoryEnvelope> => {
    const validBody = UpdateCategorySchema.parse(body);
    return http(`/finance/categories/${id}`, CategoryEnvelopeSchema, { method: 'PATCH', body: validBody });
  },

  deleteCategory: (id: string): Promise<void> =>
    http(`/finance/categories/${id}`, NoContent, { method: 'DELETE' }),

  // --- Contreparties ---
  counterparties: (
    params?: Partial<ListCounterpartiesQuery>,
    signal?: AbortSignal,
  ): Promise<CounterpartyListEnvelope> =>
    http(
      `/finance/counterparties${queryString(params as unknown as ListParams)}`,
      CounterpartyListEnvelopeSchema,
      signalOf(signal),
    ),

  createCounterparty: (body: CreateCounterparty): Promise<CounterpartyEnvelope> => {
    const validBody = CreateCounterpartySchema.parse(body);
    return http('/finance/counterparties', CounterpartyEnvelopeSchema, { method: 'POST', body: validBody });
  },

  updateCounterparty: (id: string, body: UpdateCounterparty): Promise<CounterpartyEnvelope> => {
    const validBody = UpdateCounterpartySchema.parse(body);
    return http(`/finance/counterparties/${id}`, CounterpartyEnvelopeSchema, {
      method: 'PATCH',
      body: validBody,
    });
  },

  // --- Transactions ---
  transactions: (
    params?: Partial<ListTransactionsQuery>,
    signal?: AbortSignal,
  ): Promise<TransactionListEnvelope> =>
    http(
      `/finance/transactions${queryString(params as unknown as ListParams)}`,
      TransactionListEnvelopeSchema,
      signalOf(signal),
    ),

  transaction: (id: string, signal?: AbortSignal): Promise<TransactionEnvelope> =>
    http(`/finance/transactions/${id}`, TransactionEnvelopeSchema, signalOf(signal)),

  createTransaction: (body: CreateTransactionInput, idempotencyKey: string): Promise<TransactionEnvelope> => {
    const validBody = CreateTransactionSchema.parse(body);
    return http('/finance/transactions', TransactionEnvelopeSchema, {
      method: 'POST',
      body: validBody,
      idempotencyKey,
    });
  },

  updateTransaction: (id: string, body: UpdateTransactionDetails): Promise<TransactionEnvelope> => {
    const validBody = UpdateTransactionDetailsSchema.parse(body);
    return http(`/finance/transactions/${id}`, TransactionEnvelopeSchema, {
      method: 'PATCH',
      body: validBody,
    });
  },

  validateTransaction: (id: string): Promise<TransactionEnvelope> =>
    http(`/finance/transactions/${id}/validate`, TransactionEnvelopeSchema, { method: 'POST' }),

  cancelTransaction: (id: string, body: CancelTransaction): Promise<TransactionEnvelope> => {
    const validBody = CancelTransactionSchema.parse(body);
    return http(`/finance/transactions/${id}/cancel`, TransactionEnvelopeSchema, {
      method: 'POST',
      body: validBody,
    });
  },

  // --- Transferts ---
  createTransfer: (body: CreateTransferInput, idempotencyKey: string): Promise<TransferEnvelope> => {
    const validBody = CreateTransferSchema.parse(body);
    return http('/finance/transfers', TransferEnvelopeSchema, {
      method: 'POST',
      body: validBody,
      idempotencyKey,
    });
  },

  // --- Rapports ---
  summaryReport: (params?: FinanceSummaryQuery, signal?: AbortSignal): Promise<FinanceSummaryEnvelope> =>
    http(
      `/finance/reports/summary${queryString(params as unknown as ListParams)}`,
      FinanceSummaryEnvelopeSchema,
      signalOf(signal),
    ),

  balancesReport: (params?: BalancesReportQuery, signal?: AbortSignal): Promise<BalancesReportEnvelope> =>
    http(
      `/finance/reports/balances${queryString(params as unknown as ListParams)}`,
      BalancesReportEnvelopeSchema,
      signalOf(signal),
    ),

  categoryBreakdownReport: (
    params: CategoryBreakdownQuery,
    signal?: AbortSignal,
  ): Promise<CategoryBreakdownEnvelope> =>
    http(
      `/finance/reports/by-category${queryString(params as unknown as ListParams)}`,
      CategoryBreakdownEnvelopeSchema,
      signalOf(signal),
    ),

  cashFlowReport: (params: CashFlowQuery, signal?: AbortSignal): Promise<CashFlowEnvelope> =>
    http(
      `/finance/reports/cashflow${queryString(params as unknown as ListParams)}`,
      CashFlowEnvelopeSchema,
      signalOf(signal),
    ),

  // --- Dettes & Créances ---
  debts: (params?: Partial<ListDebtsQuery>, signal?: AbortSignal): Promise<DebtListEnvelope> =>
    http(
      `/finance/debts${queryString(params as unknown as ListParams)}`,
      DebtListEnvelopeSchema,
      signalOf(signal),
    ),

  debt: (id: string, signal?: AbortSignal): Promise<DebtEnvelope> =>
    http(`/finance/debts/${id}`, DebtEnvelopeSchema, signalOf(signal)),

  debtSummary: (signal?: AbortSignal): Promise<DebtSummaryEnvelope> =>
    http('/finance/debts/summary', DebtSummaryEnvelopeSchema, signalOf(signal)),

  createDebt: (body: CreateDebtInput, idempotencyKey: string): Promise<DebtEnvelope> => {
    const validBody = CreateDebtSchema.parse(body);
    return http('/finance/debts', DebtEnvelopeSchema, {
      method: 'POST',
      body: validBody,
      idempotencyKey,
    });
  },

  updateDebt: (id: string, body: UpdateDebt): Promise<DebtEnvelope> => {
    const validBody = UpdateDebtSchema.parse(body);
    return http(`/finance/debts/${id}`, DebtEnvelopeSchema, {
      method: 'PATCH',
      body: validBody,
    });
  },

  cancelDebt: (id: string, body: CancelDebtInput, idempotencyKey: string): Promise<DebtEnvelope> => {
    const validBody = CancelDebtSchema.parse(body);
    return http(`/finance/debts/${id}/cancel`, DebtEnvelopeSchema, {
      method: 'POST',
      body: validBody,
      idempotencyKey,
    });
  },

  writeOffDebt: (id: string, body: WriteOffDebtInput, idempotencyKey: string): Promise<DebtEnvelope> => {
    const validBody = WriteOffDebtSchema.parse(body);
    return http(`/finance/debts/${id}/write-off`, DebtEnvelopeSchema, {
      method: 'POST',
      body: validBody,
      idempotencyKey,
    });
  },

  debtRepayments: (debtId: string, signal?: AbortSignal): Promise<RepaymentListEnvelope> =>
    http(`/finance/debts/${debtId}/repayments`, RepaymentListEnvelopeSchema, signalOf(signal)),

  createDebtRepayment: (
    debtId: string,
    body: CreateRepaymentInput,
    idempotencyKey: string,
  ): Promise<RepaymentEnvelope> => {
    const validBody = CreateRepaymentSchema.parse(body);
    return http(`/finance/debts/${debtId}/repayments`, RepaymentEnvelopeSchema, {
      method: 'POST',
      body: validBody,
      idempotencyKey,
    });
  },

  deleteDebtRepayment: (debtId: string, repaymentId: string): Promise<void> =>
    http(`/finance/debts/${debtId}/repayments/${repaymentId}`, NoContent, {
      method: 'DELETE',
    }),

  // --- Récurrences ---
  recurringTransactions: (
    params?: Partial<ListRecurringTransactionsQuery>,
    signal?: AbortSignal,
  ): Promise<RecurringTransactionListEnvelope> =>
    http(
      `/finance/recurring${queryString(params as unknown as ListParams)}`,
      RecurringTransactionListEnvelopeSchema,
      signalOf(signal),
    ),

  recurringTransaction: (id: string, signal?: AbortSignal): Promise<RecurringTransactionEnvelope> =>
    http(`/finance/recurring/${id}`, RecurringTransactionEnvelopeSchema, signalOf(signal)),

  createRecurringTransaction: (
    body: CreateRecurringTransactionInput,
    idempotencyKey: string,
  ): Promise<RecurringTransactionEnvelope> => {
    const validBody = CreateRecurringTransactionSchema.parse(body);
    return http('/finance/recurring', RecurringTransactionEnvelopeSchema, {
      method: 'POST',
      body: validBody,
      idempotencyKey,
    });
  },

  updateRecurringTransaction: (
    id: string,
    body: UpdateRecurringTransaction,
  ): Promise<RecurringTransactionEnvelope> => {
    const validBody = UpdateRecurringTransactionSchema.parse(body);
    return http(`/finance/recurring/${id}`, RecurringTransactionEnvelopeSchema, {
      method: 'PATCH',
      body: validBody,
    });
  },

  pauseRecurring: (id: string): Promise<RecurringTransactionEnvelope> =>
    http(`/finance/recurring/${id}/pause`, RecurringTransactionEnvelopeSchema, { method: 'POST' }),

  resumeRecurring: (id: string): Promise<RecurringTransactionEnvelope> =>
    http(`/finance/recurring/${id}/resume`, RecurringTransactionEnvelopeSchema, { method: 'POST' }),

  recurringOccurrences: (id: string, signal?: AbortSignal): Promise<RecurringOccurrenceListEnvelope> =>
    http(`/finance/recurring/${id}/occurrences`, RecurringOccurrenceListEnvelopeSchema, signalOf(signal)),

  occurrences: (
    params?: Partial<ListOccurrencesQuery>,
    signal?: AbortSignal,
  ): Promise<RecurringOccurrenceListEnvelope> =>
    http(
      `/finance/recurring/occurrences${queryString(params as unknown as ListParams)}`,
      RecurringOccurrenceListEnvelopeSchema,
      signalOf(signal),
    ),

  confirmOccurrence: (
    occurrenceId: string,
    body: ConfirmOccurrenceInput,
    idempotencyKey: string,
  ): Promise<RecurringOccurrenceEnvelope> => {
    const validBody = ConfirmOccurrenceSchema.parse(body);
    return http(`/finance/recurring/occurrences/${occurrenceId}/confirm`, RecurringOccurrenceEnvelopeSchema, {
      method: 'POST',
      body: validBody,
      idempotencyKey,
    });
  },

  skipOccurrence: (
    occurrenceId: string,
    body?: SkipOccurrenceInput,
  ): Promise<RecurringOccurrenceEnvelope> => {
    const validBody = body ? SkipOccurrenceSchema.parse(body) : {};
    return http(`/finance/recurring/occurrences/${occurrenceId}/skip`, RecurringOccurrenceEnvelopeSchema, {
      method: 'POST',
      body: validBody,
    });
  },

  // --- Prévisions ---
  forecast: (params?: Partial<ForecastQuery>, signal?: AbortSignal): Promise<ForecastReportEnvelope> =>
    http(
      `/finance/reports/forecast${queryString(params as unknown as ListParams)}`,
      ForecastReportEnvelopeSchema,
      signalOf(signal),
    ),
};
