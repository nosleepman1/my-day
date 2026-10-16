/**
 * Clés de requête partagées entre modules (FRONTEND.md §4.2) : la session (`/me*`) est lue par les
 * gardes, le shell, l'authentification et les paramètres.
 */
export const sessionKeys = {
  all: ['me'] as const,
  me: () => [...sessionKeys.all, 'profile'] as const,
  preferences: () => [...sessionKeys.all, 'preferences'] as const,
  sessions: () => [...sessionKeys.all, 'sessions'] as const,
  loginEvents: () => [...sessionKeys.all, 'login-events'] as const,
};

type Params = Readonly<Record<string, string | undefined>>;
type Resource = 'ideas' | 'projects' | 'tasks' | 'notes';

/**
 * Organisation (M03) : invalidée en bloc après chaque écriture, y compris par la capture rapide et le
 * rejeu de la file hors ligne, qui vivent dans le chunk initial.
 */
export const organizationKeys = {
  all: ['organization'] as const,
  list: (resource: Resource, params: Params) => [...organizationKeys.all, resource, 'list', params] as const,
  item: (resource: Resource, id: string) => [...organizationKeys.all, resource, 'item', id] as const,
  detail: (resource: Resource, id: string, part: string) =>
    [...organizationKeys.all, resource, 'item', id, part] as const,
  tags: () => [...organizationKeys.all, 'tags'] as const,
};

/**
 * Finance (M04 / PHASE-05) : comptes, transactions, rapports, catégories et contreparties.
 */
export const financeKeys = {
  all: ['finance'] as const,
  accounts: (params?: Params) => [...financeKeys.all, 'accounts', params] as const,
  account: (id: string) => [...financeKeys.all, 'account', id] as const,
  reconciliationPreview: (id: string, date?: string) =>
    [...financeKeys.account(id), 'reconciliation', date] as const,
  categories: (params?: Params) => [...financeKeys.all, 'categories', params] as const,
  counterparties: (params?: Params) => [...financeKeys.all, 'counterparties', params] as const,
  transactions: (params?: Params) => [...financeKeys.all, 'transactions', params] as const,
  transaction: (id: string) => [...financeKeys.all, 'transaction', id] as const,
  debts: (params?: Params) => [...financeKeys.all, 'debts', params] as const,
  debt: (id: string) => [...financeKeys.all, 'debt', id] as const,
  debtSummary: () => [...financeKeys.all, 'debts', 'summary'] as const,
  debtRepayments: (id: string) => [...financeKeys.debt(id), 'repayments'] as const,
  recurringTransactions: (params?: Params) =>
    [...financeKeys.all, 'recurring', 'transactions', params] as const,
  recurringTransaction: (id: string) => [...financeKeys.all, 'recurring', 'transaction', id] as const,
  recurringOccurrences: (params?: Params) =>
    [...financeKeys.all, 'recurring', 'occurrences', params] as const,
  reports: {
    summary: (params?: Params) => [...financeKeys.all, 'reports', 'summary', params] as const,
    balances: () => [...financeKeys.all, 'reports', 'balances'] as const,
    byCategory: (params?: Params) => [...financeKeys.all, 'reports', 'by-category', params] as const,
    cashflow: (params?: Params) => [...financeKeys.all, 'reports', 'cashflow', params] as const,
    forecast: (params?: Params) => [...financeKeys.all, 'reports', 'forecast', params] as const,
  },
};
