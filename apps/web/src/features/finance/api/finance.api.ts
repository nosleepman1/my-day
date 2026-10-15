import { z } from 'zod';

import {
  AccountAdjustmentSchema,
  AccountEnvelopeSchema,
  AccountListEnvelopeSchema,
  BalancesReportEnvelopeSchema,
  CancelTransactionSchema,
  CashFlowEnvelopeSchema,
  CategoryBreakdownEnvelopeSchema,
  CategoryEnvelopeSchema,
  CategoryListEnvelopeSchema,
  CloseAccountSchema,
  ConfirmReconciliationSchema,
  CounterpartyEnvelopeSchema,
  CounterpartyListEnvelopeSchema,
  CreateAccountSchema,
  CreateCategorySchema,
  CreateCounterpartySchema,
  CreateTransactionSchema,
  CreateTransferSchema,
  FinanceSummaryEnvelopeSchema,
  ReconciliationResultEnvelopeSchema,
  ReconciliationStatusEnvelopeSchema,
  ReopenAccountSchema,
  TransactionEnvelopeSchema,
  TransactionListEnvelopeSchema,
  TransferEnvelopeSchema,
  UpdateAccountSchema,
  UpdateCategorySchema,
  UpdateCounterpartySchema,
  UpdateTransactionDetailsSchema,
  type AccountAdjustmentInput,
  type AccountEnvelope,
  type AccountListEnvelope,
  type BalancesReportEnvelope,
  type BalancesReportQuery,
  type CancelTransaction,
  type CashFlowEnvelope,
  type CashFlowQuery,
  type CategoryBreakdownEnvelope,
  type CategoryBreakdownQuery,
  type CategoryEnvelope,
  type CategoryListEnvelope,
  type ConfirmReconciliation,
  type CounterpartyEnvelope,
  type CounterpartyListEnvelope,
  type CreateAccountInput,
  type CreateCategory,
  type CreateCounterparty,
  type CreateTransactionInput,
  type CreateTransferInput,
  type FinanceSummaryEnvelope,
  type FinanceSummaryQuery,
  type ListAccountsQuery,
  type ListCategoriesQuery,
  type ListCounterpartiesQuery,
  type ListTransactionsQuery,
  type ReconciliationQuery,
  type ReconciliationResultEnvelope,
  type ReconciliationStatusEnvelope,
  type TransactionEnvelope,
  type TransactionListEnvelope,
  type TransferEnvelope,
  type UpdateAccount,
  type UpdateCategory,
  type UpdateCounterparty,
  type UpdateTransactionDetails,
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
};
