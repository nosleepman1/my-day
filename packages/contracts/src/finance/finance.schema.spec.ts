import { describe, expect, it } from 'vitest';

import {
  CreateAccountSchema,
  UpdateAccountSchema,
  CloseAccountSchema,
  AccountResponseSchema,
} from './accounts.schema';
import { CreateCategorySchema, UpdateCategorySchema, CategoryResponseSchema } from './categories.schema';
import {
  CreateCounterpartySchema,
  UpdateCounterpartySchema,
  MergeCounterpartySchema,
} from './counterparties.schema';
import { StartReconciliationSchema, ReconcileTransactionsSchema } from './reconciliation.schema';
import {
  CashFlowQuerySchema,
  CashFlowReportSchema,
  NetWorthReportSchema,
  CategoryBreakdownReportSchema,
} from './reports.schema';
import {
  CreateTransactionSchema,
  UpdateTransactionDetailsSchema,
  CancelTransactionSchema,
  TransactionResponseSchema,
} from './transactions.schema';
import { CreateTransferSchema } from './transfers.schema';

const UUID_1 = '01927000-0000-7000-8000-000000000001';
const UUID_2 = '01927000-0000-7000-8000-000000000002';
const NOW_ISO = '2026-10-15T12:00:00.000Z';
const TODAY_CIVIL = '2026-10-15';

describe('finance contracts', () => {
  describe('accounts schemas', () => {
    it('validates a correct account creation with default values', () => {
      const parsed = CreateAccountSchema.parse({
        name: 'Compte Principal',
        type: 'CHECKING',
        currency: 'XOF',
        openedOn: TODAY_CIVIL,
      });
      expect(parsed.name).toBe('Compte Principal');
      expect(parsed.type).toBe('CHECKING');
      expect(parsed.currency).toBe('XOF');
      expect(parsed.openingBalanceMinor).toBe('0');
      expect(parsed.allowOverdraft).toBe(false);
    });

    it('rejects unknown or invalid currencies', () => {
      const result = CreateAccountSchema.safeParse({
        name: 'Compte EUR',
        type: 'SAVINGS',
        currency: 'XYZ',
        openedOn: TODAY_CIVIL,
      });
      expect(result.success).toBe(false);
    });

    it('rejects immutable fields in UpdateAccountSchema (strict)', () => {
      const result = UpdateAccountSchema.safeParse({
        name: 'Nouveau nom',
        currency: 'EUR',
      });
      expect(result.success).toBe(false);
    });

    it('validates CloseAccountSchema', () => {
      const parsed = CloseAccountSchema.parse({
        closedOn: TODAY_CIVIL,
        notes: 'Fermé définitivement',
      });
      expect(parsed.closedOn).toBe(TODAY_CIVIL);
    });

    it('validates full AccountResponseSchema', () => {
      const parsed = AccountResponseSchema.parse({
        id: UUID_1,
        name: 'Compte Cash',
        type: 'CASH',
        currency: 'XOF',
        currentBalanceMinor: '150000',
        openingBalanceMinor: '0',
        openedOn: TODAY_CIVIL,
        closedOn: null,
        allowOverdraft: false,
        notes: null,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
      });
      expect(parsed.id).toBe(UUID_1);
      expect(parsed.currentBalanceMinor).toBe('150000');
    });
  });

  describe('categories schemas', () => {
    it('validates category creation and defaults', () => {
      const parsed = CreateCategorySchema.parse({
        name: 'Alimentation',
        kind: 'EXPENSE',
        defaultEconomicClass: 'EXPENSE_OPERATING',
        color: '#FF5733',
      });
      expect(parsed.name).toBe('Alimentation');
      expect(parsed.kind).toBe('EXPENSE');
    });

    it('rejects an invalid hex color', () => {
      const result = CreateCategorySchema.safeParse({
        name: 'Transport',
        kind: 'EXPENSE',
        defaultEconomicClass: 'EXPENSE_OPERATING',
        color: 'red',
      });
      expect(result.success).toBe(false);
    });

    it('validates UpdateCategorySchema', () => {
      const parsed = UpdateCategorySchema.parse({
        name: 'Alimentation & Boissons',
        parentId: null,
      });
      expect(parsed.name).toBe('Alimentation & Boissons');
    });

    it('validates CategoryResponseSchema', () => {
      const parsed = CategoryResponseSchema.parse({
        id: UUID_1,
        name: 'Salaire',
        kind: 'INCOME',
        defaultEconomicClass: 'INCOME_OPERATING',
        parentId: null,
        icon: 'briefcase',
        color: '#00AA00',
        isSystem: false,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
      });
      expect(parsed.name).toBe('Salaire');
      expect(parsed.isSystem).toBe(false);
    });
  });

  describe('counterparties schemas', () => {
    it('validates counterparty creation with default type OTHER', () => {
      const parsed = CreateCounterpartySchema.parse({
        name: 'Boulangerie du Coin',
      });
      expect(parsed.name).toBe('Boulangerie du Coin');
      expect(parsed.type).toBe('OTHER');
    });

    it('validates UpdateCounterpartySchema', () => {
      const parsed = UpdateCounterpartySchema.parse({
        name: 'Boulangerie Artisanale',
        type: 'MERCHANT',
      });
      expect(parsed.name).toBe('Boulangerie Artisanale');
      expect(parsed.type).toBe('MERCHANT');
    });

    it('validates MergeCounterpartySchema', () => {
      const parsed = MergeCounterpartySchema.parse({
        targetCounterpartyId: UUID_2,
      });
      expect(parsed.targetCounterpartyId).toBe(UUID_2);
    });
  });

  describe('transactions schemas', () => {
    it('validates UpdateTransactionDetailsSchema', () => {
      const parsed = UpdateTransactionDetailsSchema.parse({
        description: 'Nouvelle description',
        categoryId: UUID_2,
      });
      expect(parsed.description).toBe('Nouvelle description');
      expect(parsed.categoryId).toBe(UUID_2);
    });
    it('validates standard expense creation', () => {
      const parsed = CreateTransactionSchema.parse({
        type: 'EXPENSE',
        accountId: UUID_1,
        amountMinor: '25000',
        currency: 'XOF',
        occurredAt: NOW_ISO,
        valueDate: TODAY_CIVIL,
        description: 'Courses hebdomadaires',
      });
      expect(parsed.type).toBe('EXPENSE');
      expect(parsed.status).toBe('VALIDATED');
      expect(parsed.amountMinor).toBe('25000');
    });

    it('requires adjustmentDirection when type is ADJUSTMENT', () => {
      const missingDirection = CreateTransactionSchema.safeParse({
        type: 'ADJUSTMENT',
        accountId: UUID_1,
        amountMinor: '1000',
        currency: 'XOF',
        occurredAt: NOW_ISO,
        valueDate: TODAY_CIVIL,
      });
      expect(missingDirection.success).toBe(false);

      const withDirection = CreateTransactionSchema.safeParse({
        type: 'ADJUSTMENT',
        accountId: UUID_1,
        amountMinor: '1000',
        currency: 'XOF',
        occurredAt: NOW_ISO,
        valueDate: TODAY_CIVIL,
        adjustmentDirection: 'CREDIT',
      });
      expect(withDirection.success).toBe(true);
    });

    it('rejects non-positive amounts or float amounts', () => {
      expect(
        CreateTransactionSchema.safeParse({
          type: 'EXPENSE',
          accountId: UUID_1,
          amountMinor: '0',
          currency: 'XOF',
          occurredAt: NOW_ISO,
          valueDate: TODAY_CIVIL,
        }).success,
      ).toBe(false);

      expect(
        CreateTransactionSchema.safeParse({
          type: 'EXPENSE',
          accountId: UUID_1,
          amountMinor: '12.50',
          currency: 'EUR',
          occurredAt: NOW_ISO,
          valueDate: TODAY_CIVIL,
        }).success,
      ).toBe(false);
    });

    it('validates CancelTransactionSchema with min 3 chars reason', () => {
      expect(CancelTransactionSchema.safeParse({ reason: 'no' }).success).toBe(false);
      expect(CancelTransactionSchema.safeParse({ reason: 'Saisie en double par erreur' }).success).toBe(true);
    });

    it('validates full TransactionResponseSchema including ledger entries', () => {
      const parsed = TransactionResponseSchema.parse({
        id: UUID_1,
        type: 'EXPENSE',
        status: 'VALIDATED',
        economicClass: 'EXPENSE_OPERATING',
        amountMinor: '5000',
        currency: 'XOF',
        occurredAt: NOW_ISO,
        valueDate: TODAY_CIVIL,
        source: 'MANUAL',
        description: 'Repas',
        notes: null,
        categoryId: UUID_2,
        counterpartyId: null,
        transferId: null,
        cancelReason: null,
        cancelledAt: null,
        ledgerEntries: [
          {
            id: UUID_1,
            transactionId: UUID_1,
            accountId: UUID_2,
            direction: 'DEBIT',
            amountMinor: '5000',
            currency: 'XOF',
            createdAt: NOW_ISO,
          },
        ],
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
      });
      expect(parsed.ledgerEntries).toHaveLength(1);
    });
  });

  describe('transfers schemas', () => {
    it('validates a transfer between two different accounts', () => {
      const parsed = CreateTransferSchema.parse({
        fromAccountId: UUID_1,
        toAccountId: UUID_2,
        fromAmountMinor: '50000',
        occurredAt: NOW_ISO,
        valueDate: TODAY_CIVIL,
      });
      expect(parsed.fromAccountId).toBe(UUID_1);
      expect(parsed.toAccountId).toBe(UUID_2);
    });

    it('rejects a transfer towards the same account', () => {
      const result = CreateTransferSchema.safeParse({
        fromAccountId: UUID_1,
        toAccountId: UUID_1,
        fromAmountMinor: '50000',
        occurredAt: NOW_ISO,
        valueDate: TODAY_CIVIL,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('reports schemas', () => {
    it('validates cash flow query and report', () => {
      const query = CashFlowQuerySchema.parse({
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
        currency: 'XOF',
      });
      expect(query.currency).toBe('XOF');

      const report = CashFlowReportSchema.parse({
        period: { fromDate: '2026-01-01', toDate: '2026-12-31' },
        currency: 'XOF',
        totalIncomeMinor: '1000000',
        totalExpenseMinor: '600000',
        netCashFlowMinor: '400000',
        byEconomicClass: {
          INCOME_OPERATING: '1000000',
          EXPENSE_OPERATING: '600000',
        },
        byMonth: [
          {
            month: '2026-01',
            incomeMinor: '500000',
            expenseMinor: '300000',
            netMinor: '200000',
          },
        ],
      });
      expect(report.netCashFlowMinor).toBe('400000');
    });

    it('validates net worth report', () => {
      const report = NetWorthReportSchema.parse({
        asOfDate: TODAY_CIVIL,
        baseCurrency: 'XOF',
        totalAssetsMinor: '2000000',
        totalLiabilitiesMinor: '500000',
        netWorthMinor: '150000',
        accounts: [
          {
            accountId: UUID_1,
            name: 'Compte courant',
            type: 'CHECKING',
            currency: 'XOF',
            balanceMinor: '1500000',
            balanceInBaseMinor: '1500000',
          },
        ],
      });
      expect(report.accounts).toHaveLength(1);
    });

    it('validates category breakdown report', () => {
      const report = CategoryBreakdownReportSchema.parse({
        period: { fromDate: '2026-01-01', toDate: '2026-12-31' },
        currency: 'XOF',
        kind: 'EXPENSE',
        totalMinor: '100000',
        categories: [
          {
            categoryId: UUID_1,
            categoryName: 'Loyer',
            amountMinor: '100000',
            percentage: 100,
          },
        ],
      });
      expect(report.categories[0]?.percentage).toBe(100);
    });
  });

  describe('reconciliation schemas', () => {
    it('validates StartReconciliationSchema', () => {
      const parsed = StartReconciliationSchema.parse({
        accountId: UUID_1,
        statementDate: TODAY_CIVIL,
        statementEndingBalanceMinor: '250000',
      });
      expect(parsed.statementEndingBalanceMinor).toBe('250000');
    });

    it('validates ReconcileTransactionsSchema', () => {
      const parsed = ReconcileTransactionsSchema.parse({
        accountId: UUID_1,
        statementDate: TODAY_CIVIL,
        statementEndingBalanceMinor: '250000',
        transactionIds: [UUID_1, UUID_2],
      });
      expect(parsed.transactionIds).toHaveLength(2);
      expect(parsed.createAdjustmentIfNeeded).toBe(false);
    });
  });
});
