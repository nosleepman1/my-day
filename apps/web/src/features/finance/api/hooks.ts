import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import type {
  AccountEnvelope,
  AccountListEnvelope,
  BalancesReportEnvelope,
  BalancesReportQuery,
  CashFlowEnvelope,
  CashFlowQuery,
  CategoryBreakdownEnvelope,
  CategoryBreakdownQuery,
  CategoryListEnvelope,
  CounterpartyListEnvelope,
  DebtEnvelope,
  DebtListEnvelope,
  DebtSummaryEnvelope,
  FinanceSummaryEnvelope,
  FinanceSummaryQuery,
  ForecastQuery,
  ForecastReportEnvelope,
  ListAccountsQuery,
  ListCategoriesQuery,
  ListCounterpartiesQuery,
  ListDebtsQuery,
  ListOccurrencesQuery,
  ListRecurringTransactionsQuery,
  ListTransactionsQuery,
  ReconciliationQuery,
  ReconciliationStatusEnvelope,
  RecurringOccurrenceListEnvelope,
  RecurringTransactionEnvelope,
  RecurringTransactionListEnvelope,
  RepaymentListEnvelope,
  TransactionEnvelope,
  TransactionListEnvelope,
} from '@orbit/contracts';

import { financeKeys } from '@/lib/query-keys';

import { financeApi } from './finance.api';

export function useFinanceAccounts(
  params?: Partial<ListAccountsQuery>,
  enabled = true,
): UseQueryResult<AccountListEnvelope> {
  return useQuery({
    queryKey: financeKeys.accounts(params as unknown as Record<string, string | undefined>),
    queryFn: ({ signal }) => financeApi.listAccounts(params, signal),
    enabled,
  });
}

export function useFinanceAccount(id: string, enabled = true): UseQueryResult<AccountEnvelope> {
  return useQuery({
    queryKey: financeKeys.account(id),
    queryFn: ({ signal }) => financeApi.account(id, signal),
    enabled: enabled && id !== '',
  });
}

export function useFinanceCategories(
  params?: Partial<ListCategoriesQuery>,
  enabled = true,
): UseQueryResult<CategoryListEnvelope> {
  return useQuery({
    queryKey: financeKeys.categories(params as unknown as Record<string, string | undefined>),
    queryFn: ({ signal }) => financeApi.categories(params, signal),
    enabled,
  });
}

export function useFinanceCounterparties(
  params?: Partial<ListCounterpartiesQuery>,
  enabled = true,
): UseQueryResult<CounterpartyListEnvelope> {
  return useQuery({
    queryKey: financeKeys.counterparties(params as unknown as Record<string, string | undefined>),
    queryFn: ({ signal }) => financeApi.counterparties(params, signal),
    enabled,
  });
}

export function useFinanceTransactions(
  params?: Partial<ListTransactionsQuery>,
  enabled = true,
): UseQueryResult<TransactionListEnvelope> {
  return useQuery({
    queryKey: financeKeys.transactions(params as unknown as Record<string, string | undefined>),
    queryFn: ({ signal }) => financeApi.transactions(params, signal),
    enabled,
  });
}

export function useFinanceTransaction(id: string, enabled = true): UseQueryResult<TransactionEnvelope> {
  return useQuery({
    queryKey: financeKeys.transaction(id),
    queryFn: ({ signal }) => financeApi.transaction(id, signal),
    enabled: enabled && id !== '',
  });
}

export function useFinanceReconciliationPreview(
  id: string,
  query: ReconciliationQuery,
  enabled = true,
): UseQueryResult<ReconciliationStatusEnvelope> {
  return useQuery({
    queryKey: financeKeys.reconciliationPreview(id, query.statementDate),
    queryFn: ({ signal }) => financeApi.reconciliationPreview(id, query, signal),
    enabled: enabled && id !== '',
  });
}

export function useFinanceSummaryReport(
  params?: FinanceSummaryQuery,
  enabled = true,
): UseQueryResult<FinanceSummaryEnvelope> {
  return useQuery({
    queryKey: financeKeys.reports.summary(params as Record<string, string | undefined>),
    queryFn: ({ signal }) => financeApi.summaryReport(params, signal),
    enabled,
  });
}

export function useFinanceBalancesReport(
  params?: BalancesReportQuery,
  enabled = true,
): UseQueryResult<BalancesReportEnvelope> {
  return useQuery({
    queryKey: financeKeys.reports.balances(),
    queryFn: ({ signal }) => financeApi.balancesReport(params, signal),
    enabled,
  });
}

export function useFinanceCategoryBreakdownReport(
  params: CategoryBreakdownQuery,
  enabled = true,
): UseQueryResult<CategoryBreakdownEnvelope> {
  return useQuery({
    queryKey: financeKeys.reports.byCategory(params as unknown as Record<string, string | undefined>),
    queryFn: ({ signal }) => financeApi.categoryBreakdownReport(params, signal),
    enabled,
  });
}

export function useFinanceCashFlowReport(
  params: CashFlowQuery,
  enabled = true,
): UseQueryResult<CashFlowEnvelope> {
  return useQuery({
    queryKey: financeKeys.reports.cashflow(params as unknown as Record<string, string | undefined>),
    queryFn: ({ signal }) => financeApi.cashFlowReport(params, signal),
    enabled,
  });
}

export function useFinanceDebts(
  params?: Partial<ListDebtsQuery>,
  enabled = true,
): UseQueryResult<DebtListEnvelope> {
  return useQuery({
    queryKey: financeKeys.debts(params as unknown as Record<string, string | undefined>),
    queryFn: ({ signal }) => financeApi.debts(params, signal),
    enabled,
  });
}

export function useFinanceDebt(id: string, enabled = true): UseQueryResult<DebtEnvelope> {
  return useQuery({
    queryKey: financeKeys.debt(id),
    queryFn: ({ signal }) => financeApi.debt(id, signal),
    enabled: enabled && id !== '',
  });
}

export function useFinanceDebtSummary(enabled = true): UseQueryResult<DebtSummaryEnvelope> {
  return useQuery({
    queryKey: financeKeys.debtSummary(),
    queryFn: ({ signal }) => financeApi.debtSummary(signal),
    enabled,
  });
}

export function useFinanceDebtRepayments(
  debtId: string,
  enabled = true,
): UseQueryResult<RepaymentListEnvelope> {
  return useQuery({
    queryKey: financeKeys.debtRepayments(debtId),
    queryFn: ({ signal }) => financeApi.debtRepayments(debtId, signal),
    enabled: enabled && debtId !== '',
  });
}

export function useFinanceRecurringTransactions(
  params?: Partial<ListRecurringTransactionsQuery>,
  enabled = true,
): UseQueryResult<RecurringTransactionListEnvelope> {
  return useQuery({
    queryKey: financeKeys.recurringTransactions(params as unknown as Record<string, string | undefined>),
    queryFn: ({ signal }) => financeApi.recurringTransactions(params, signal),
    enabled,
  });
}

export function useFinanceRecurringTransaction(
  id: string,
  enabled = true,
): UseQueryResult<RecurringTransactionEnvelope> {
  return useQuery({
    queryKey: financeKeys.recurringTransaction(id),
    queryFn: ({ signal }) => financeApi.recurringTransaction(id, signal),
    enabled: enabled && id !== '',
  });
}

export function useFinanceRecurringOccurrences(
  recurringId: string,
  enabled = true,
): UseQueryResult<RecurringOccurrenceListEnvelope> {
  return useQuery({
    queryKey: financeKeys.recurringOccurrences({ recurringTransactionId: recurringId }),
    queryFn: ({ signal }) => financeApi.recurringOccurrences(recurringId, signal),
    enabled: enabled && recurringId !== '',
  });
}

export function useFinanceOccurrences(
  params?: Partial<ListOccurrencesQuery>,
  enabled = true,
): UseQueryResult<RecurringOccurrenceListEnvelope> {
  return useQuery({
    queryKey: financeKeys.recurringOccurrences(params as unknown as Record<string, string | undefined>),
    queryFn: ({ signal }) => financeApi.occurrences(params, signal),
    enabled,
  });
}

export function useFinanceForecast(
  params?: Partial<ForecastQuery>,
  enabled = true,
): UseQueryResult<ForecastReportEnvelope> {
  return useQuery({
    queryKey: financeKeys.reports.forecast(params as unknown as Record<string, string | undefined>),
    queryFn: ({ signal }) => financeApi.forecast(params, signal),
    enabled,
  });
}

/**
 * Mutation financière : toute écriture réussie invalide l'ensemble du cache finance.
 */
export function useFinanceMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  options: Readonly<{ successMessage?: string }> = {},
): UseMutationResult<TResult, Error, TArgs> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      if (options.successMessage !== undefined) {
        toast.success(options.successMessage);
      }
      return queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
  });
}
