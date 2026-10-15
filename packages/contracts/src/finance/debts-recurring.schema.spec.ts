import { describe, expect, it } from 'vitest';

import {
  CancelDebtSchema,
  CreateDebtSchema,
  CreateRepaymentSchema,
  DebtEnvelopeSchema,
  DebtResponseSchema,
  DebtSummaryResponseSchema,
  ListDebtsQuerySchema,
  RepaymentResponseSchema,
  UpdateDebtSchema,
  WriteOffDebtSchema,
} from './debts.schema';
import { ForecastQuerySchema, ForecastReportResponseSchema } from './forecast.schema';
import {
  ConfirmOccurrenceSchema,
  CreateRecurringTransactionSchema,
  ListOccurrencesQuerySchema,
  RecurringOccurrenceResponseSchema,
  RecurringTransactionResponseSchema,
  SkipOccurrenceSchema,
  UpdateRecurringTransactionSchema,
} from './recurring.schema';

const UUID_1 = '01927000-0000-7000-8000-000000000001';
const UUID_2 = '01927000-0000-7000-8000-000000000002';
const UUID_3 = '01927000-0000-7000-8000-000000000003';
const NOW_ISO = '2026-10-15T12:00:00.000Z';

describe('Debts schemas', () => {
  it('validates a valid CreateDebt payload', () => {
    const input = {
      type: 'PAYABLE',
      counterpartyId: UUID_1,
      title: 'Prêt amical pour matériel',
      principalMinor: '100000',
      currency: 'XOF',
      openedOn: '2026-10-01',
      dueDate: '2026-12-01',
      notes: 'Remboursement en 2 fois',
    };
    const result = CreateDebtSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts CreateDebt with initial cash movement', () => {
    const input = {
      type: 'PAYABLE',
      counterpartyId: UUID_1,
      title: 'Emprunt bancaire',
      principalMinor: '5000000',
      currency: 'XOF',
      openedOn: '2026-10-01',
      initialMovement: {
        accountId: UUID_2,
        valueDate: '2026-10-01',
      },
    };
    const result = CreateDebtSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects CreateDebt if dueDate is before openedOn', () => {
    const input = {
      type: 'PAYABLE',
      counterpartyId: UUID_1,
      title: 'Prêt',
      principalMinor: '50000',
      currency: 'XOF',
      openedOn: '2026-10-15',
      dueDate: '2026-10-10',
    };
    const result = CreateDebtSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('dueDate');
    }
  });

  it('rejects zero or negative principalMinor', () => {
    expect(
      CreateDebtSchema.safeParse({
        type: 'PAYABLE',
        counterpartyId: UUID_1,
        title: 'Prêt',
        principalMinor: '0',
        currency: 'XOF',
        openedOn: '2026-10-01',
      }).success,
    ).toBe(false);
  });

  it('validates UpdateDebtSchema', () => {
    const result = UpdateDebtSchema.safeParse({
      title: 'Nouveau titre',
      dueDate: null,
      notes: null,
    });
    expect(result.success).toBe(true);
  });

  it('validates CancelDebt and WriteOffDebt closing reasons', () => {
    expect(CancelDebtSchema.safeParse({ closingReason: 'Erreur de saisie' }).success).toBe(true);
    expect(CancelDebtSchema.safeParse({ closingReason: 'ab' }).success).toBe(false);
    expect(WriteOffDebtSchema.safeParse({ closingReason: 'Débiteur insolvable constaté' }).success).toBe(
      true,
    );
  });

  it('validates ListDebtsQuerySchema', () => {
    const parsed = ListDebtsQuerySchema.parse({
      type: 'RECEIVABLE',
      overdue: 'true',
      limit: '20',
    });
    expect(parsed.type).toBe('RECEIVABLE');
    expect(parsed.overdue).toBe(true);
    expect(parsed.limit).toBe(20);
  });

  it('validates DebtResponseSchema and envelope', () => {
    const debt = {
      id: UUID_1,
      userId: UUID_2,
      type: 'PAYABLE',
      counterpartyId: UUID_3,
      title: 'Dette fournisseur',
      description: null,
      principalMinor: '250000',
      currency: 'XOF',
      openedOn: '2026-10-01',
      dueDate: '2026-11-01',
      status: 'OPEN',
      cancelledAt: null,
      writtenOffAt: null,
      closingReason: null,
      notes: null,
      totalRepaidMinor: '50000',
      remainingMinor: '200000',
      settlementStatus: 'PARTIALLY_SETTLED',
      isOverdue: false,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    };
    expect(DebtResponseSchema.safeParse(debt).success).toBe(true);
    expect(DebtEnvelopeSchema.safeParse({ data: debt }).success).toBe(true);
  });

  it('validates CreateRepaymentSchema with accountId (creation)', () => {
    const result = CreateRepaymentSchema.safeParse({
      accountId: UUID_1,
      amountMinor: '50000',
      date: '2026-10-15',
      notes: 'Premier versement',
    });
    expect(result.success).toBe(true);
  });

  it('validates CreateRepaymentSchema with transactionId (attachment)', () => {
    const result = CreateRepaymentSchema.safeParse({
      transactionId: UUID_2,
      amountMinor: '50000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects CreateRepaymentSchema if both accountId and transactionId are supplied', () => {
    const result = CreateRepaymentSchema.safeParse({
      accountId: UUID_1,
      transactionId: UUID_2,
      amountMinor: '50000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects CreateRepaymentSchema if neither accountId nor transactionId is supplied', () => {
    const result = CreateRepaymentSchema.safeParse({
      amountMinor: '50000',
    });
    expect(result.success).toBe(false);
  });

  it('validates RepaymentResponseSchema', () => {
    const repayment = {
      id: UUID_1,
      debtId: UUID_2,
      transactionId: UUID_3,
      amountMinor: '30000',
      currency: 'XOF',
      notes: null,
      createdAt: NOW_ISO,
    };
    expect(RepaymentResponseSchema.safeParse(repayment).success).toBe(true);
  });

  it('validates DebtSummaryResponseSchema', () => {
    const summary = {
      currencies: [
        {
          currency: 'XOF',
          totalPayableMinor: '100000',
          totalReceivableMinor: '50000',
          remainingPayableMinor: '70000',
          remainingReceivableMinor: '50000',
          overduePayableMinor: '0',
          overdueReceivableMinor: '20000',
        },
      ],
    };
    expect(DebtSummaryResponseSchema.safeParse(summary).success).toBe(true);
  });
});

describe('Recurring schemas', () => {
  it('validates a valid CreateRecurringTransaction payload (EXPENSE)', () => {
    const input = {
      name: 'Abonnement Fibre',
      type: 'EXPENSE',
      economicClass: 'EXPENSE_OPERATING',
      amountMinor: '25000',
      currency: 'XOF',
      accountId: UUID_1,
      recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=5',
      recurrenceAnchorOn: '2026-10-05',
      recurrenceTimezone: 'Africa/Dakar',
      recurrenceLocalTime: '09:00',
    };
    const result = CreateRecurringTransactionSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('validates a valid CreateRecurringTransaction payload (TRANSFER)', () => {
    const input = {
      name: 'Épargne mensuelle',
      type: 'TRANSFER',
      economicClass: 'INTERNAL_TRANSFER',
      amountMinor: '50000',
      currency: 'XOF',
      accountId: UUID_1,
      destinationAccountId: UUID_2,
      recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=1',
      recurrenceAnchorOn: '2026-10-01',
      recurrenceTimezone: 'Africa/Dakar',
    };
    const result = CreateRecurringTransactionSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects TRANSFER if destinationAccountId is missing or same as accountId', () => {
    expect(
      CreateRecurringTransactionSchema.safeParse({
        name: 'Épargne',
        type: 'TRANSFER',
        economicClass: 'INTERNAL_TRANSFER',
        amountMinor: '50000',
        currency: 'XOF',
        accountId: UUID_1,
        recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=1',
        recurrenceAnchorOn: '2026-10-01',
        recurrenceTimezone: 'Africa/Dakar',
      }).success,
    ).toBe(false);

    expect(
      CreateRecurringTransactionSchema.safeParse({
        name: 'Épargne',
        type: 'TRANSFER',
        economicClass: 'INTERNAL_TRANSFER',
        amountMinor: '50000',
        currency: 'XOF',
        accountId: UUID_1,
        destinationAccountId: UUID_1,
        recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=1',
        recurrenceAnchorOn: '2026-10-01',
        recurrenceTimezone: 'Africa/Dakar',
      }).success,
    ).toBe(false);
  });

  it('rejects EXPENSE with destinationAccountId', () => {
    expect(
      CreateRecurringTransactionSchema.safeParse({
        name: 'Abonnement',
        type: 'EXPENSE',
        economicClass: 'EXPENSE_OPERATING',
        amountMinor: '10000',
        currency: 'XOF',
        accountId: UUID_1,
        destinationAccountId: UUID_2,
        recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=1',
        recurrenceAnchorOn: '2026-10-01',
        recurrenceTimezone: 'Africa/Dakar',
      }).success,
    ).toBe(false);
  });

  it('validates UpdateRecurringTransactionSchema', () => {
    const result = UpdateRecurringTransactionSchema.safeParse({
      name: 'Nouveau nom',
      amountMinor: '30000',
      notes: null,
    });
    expect(result.success).toBe(true);
  });

  it('validates RecurringTransactionResponseSchema', () => {
    const item = {
      id: UUID_1,
      userId: UUID_2,
      name: 'Loyer',
      type: 'EXPENSE',
      economicClass: 'EXPENSE_OPERATING',
      amountMinor: '150000',
      currency: 'XOF',
      accountId: UUID_3,
      destinationAccountId: null,
      categoryId: null,
      counterpartyId: null,
      projectId: null,
      generationMode: 'CONFIRM',
      reminderDaysBefore: 3,
      status: 'ACTIVE',
      recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=1',
      recurrenceAnchorOn: '2026-10-01',
      recurrenceTimezone: 'Africa/Dakar',
      recurrenceLocalTime: '08:00',
      nextOccurrenceAt: NOW_ISO,
      generatedUntil: '2026-12-31',
      notes: null,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    };
    expect(RecurringTransactionResponseSchema.safeParse(item).success).toBe(true);
  });

  it('validates RecurringOccurrenceResponseSchema', () => {
    const item = {
      id: UUID_1,
      userId: UUID_2,
      recurringTransactionId: UUID_3,
      dueOn: '2026-11-01',
      expectedAmountMinor: '150000',
      currency: 'XOF',
      status: 'EXPECTED',
      transactionId: null,
      confirmedAt: null,
      skippedAt: null,
      createdAt: NOW_ISO,
      isOverdue: false,
    };
    expect(RecurringOccurrenceResponseSchema.safeParse(item).success).toBe(true);
  });

  it('validates ConfirmOccurrenceSchema and SkipOccurrenceSchema', () => {
    expect(
      ConfirmOccurrenceSchema.safeParse({
        amountMinor: '145000',
        valueDate: '2026-11-02',
      }).success,
    ).toBe(true);

    expect(
      ConfirmOccurrenceSchema.safeParse({
        transactionId: UUID_1,
      }).success,
    ).toBe(true);

    expect(SkipOccurrenceSchema.safeParse({ reason: 'Vacances' }).success).toBe(true);
    expect(SkipOccurrenceSchema.safeParse({}).success).toBe(true);
  });

  it('validates ListOccurrencesQuerySchema', () => {
    const query = ListOccurrencesQuerySchema.parse({
      from: '2026-10-01',
      to: '2026-12-31',
      status: 'EXPECTED',
    });
    expect(query.from).toBe('2026-10-01');
    expect(query.status).toBe('EXPECTED');
  });
});

describe('Forecast schemas', () => {
  it('validates ForecastQuerySchema with defaults', () => {
    const query = ForecastQuerySchema.parse({});
    expect(query.horizon).toBe(90);
    expect(query.includeDebts).toBe(false);
  });

  it('validates ForecastQuerySchema with custom params', () => {
    const query = ForecastQuerySchema.parse({
      horizon: '60',
      accountId: UUID_1,
      currency: 'EUR',
      includeDebts: 'true',
    });
    expect(query.horizon).toBe(60);
    expect(query.currency).toBe('EUR');
    expect(query.includeDebts).toBe(true);
  });

  it('validates ForecastReportResponseSchema', () => {
    const report = {
      horizonDays: 90,
      startDate: '2026-10-15',
      endDate: '2027-01-13',
      accounts: [
        {
          accountId: UUID_1,
          accountName: 'Compte courant',
          currency: 'XOF',
          currentBalanceMinor: '100000',
          projectedEndBalanceMinor: '80000',
          lowestProjectedBalanceMinor: '50000',
          hasProjectedNegative: false,
          points: [
            {
              date: '2026-10-15',
              realisedBalanceMinor: '100000',
              projectedBalanceMinor: '100000',
              expectedInflowsMinor: '0',
              expectedOutflowsMinor: '0',
            },
            {
              date: '2026-11-01',
              realisedBalanceMinor: null,
              projectedBalanceMinor: '80000',
              expectedInflowsMinor: '0',
              expectedOutflowsMinor: '20000',
            },
          ],
        },
      ],
      occurrences: [],
    };
    expect(ForecastReportResponseSchema.safeParse(report).success).toBe(true);
  });
});
