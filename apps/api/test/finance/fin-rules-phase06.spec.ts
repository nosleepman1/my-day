import { describe, expect, it } from 'vitest';

import {
  assertCanCancelDebt,
  assertCanRepayDebt,
  assertCanWriteOffDebt,
  computeDebtRemaining,
  deriveSettlementStatus,
} from '../../src/modules/finance/domain/debt-rules';
import {
  getEconomicImpact,
  resolveEconomicClass,
} from '../../src/modules/finance/domain/economic-classification';
import { projectAccountCashflow } from '../../src/modules/finance/domain/forecast-projector';
import { generateOccurrences } from '../../src/modules/finance/domain/recurrence-rules';
import { DomainError } from '../../src/platform/errors/domain-error';

describe('FIN-xx Named Financial Rules Test Suite - Phase 06 (FINANCE_RULES.md §6.6)', () => {
  it('[FIN-04-bis] Emprunt reçu (BORROWING) : flux atomique et position nette invariante', () => {
    // Arrange: Banque solde initial 0 XOF, dette PAYABLE 300 000
    const initialBankBalance = 0n;
    const borrowedAmount = 300_000n;

    // Act 1: Classification économique du flux BORROWING (DEBT_DRAWDOWN)
    const econClass = resolveEconomicClass('BORROWING', 'STANDARD');
    expect(econClass).toBe('DEBT_DRAWDOWN');
    expect(econClass).not.toBe('INCOME_OPERATING');
    expect(econClass).not.toBe('EXPENSE_OPERATING');

    const impact = getEconomicImpact('BORROWING', 'STANDARD', borrowedAmount);
    expect(impact.incomeImpactMinor).toBe(0n);
    expect(impact.expenseImpactMinor).toBe(0n);
    expect(impact.netPositionImpactMinor).toBe(0n);

    // Act 2: Trésorerie après crédit
    const bankBalanceAfter = initialBankBalance + borrowedAmount;
    expect(bankBalanceAfter).toBe(300_000n);

    // Act 3: Dette créée avec principal 300 000 et restant 300 000
    const remaining = computeDebtRemaining(300_000n, []);
    const status = deriveSettlementStatus(300_000n, remaining);
    expect(remaining).toBe(300_000n);
    expect(status).toBe('UNPAID');

    // Assert: Position nette = Banque - Dette = 300 000 - 300 000 = 0 (invariante)
    const netPosition = bankBalanceAfter - remaining;
    expect(netPosition).toBe(0n);
  });

  it('[FIN-05-bis] Prêt accordé (LOAN) : flux atomique et position nette invariante', () => {
    // Arrange: Espèces solde initial 100 000 XOF, prêt de 40 000
    const initialCashBalance = 100_000n;
    const loanAmount = 40_000n;

    // Act 1: Classification économique du flux LOAN (LOAN_DISBURSEMENT)
    const econClass = resolveEconomicClass('LOAN', 'STANDARD');
    expect(econClass).toBe('LOAN_DISBURSEMENT');
    expect(econClass).not.toBe('EXPENSE_OPERATING');

    const impact = getEconomicImpact('LOAN', 'STANDARD', loanAmount);
    expect(impact.incomeImpactMinor).toBe(0n);
    expect(impact.expenseImpactMinor).toBe(0n);
    expect(impact.netPositionImpactMinor).toBe(0n);

    // Act 2: Trésorerie après débit
    const cashBalanceAfter = initialCashBalance - loanAmount;
    expect(cashBalanceAfter).toBe(60_000n);

    // Act 3: Créance créée avec principal 40 000 et restant 40 000
    const remaining = computeDebtRemaining(40_000n, []);
    const status = deriveSettlementStatus(40_000n, remaining);
    expect(remaining).toBe(40_000n);
    expect(status).toBe('UNPAID');

    // Assert: Position nette = Espèces + Créance = 60 000 + 40 000 = 100 000 (invariante)
    const netPosition = cashBalanceAfter + remaining;
    expect(netPosition).toBe(100_000n);
  });

  it('[FIN-06-bis] Remboursement partiel d’une dette (PAYABLE) - Annexe A.3', () => {
    // Arrange: Dette 100 000 XOF d'origine MANUAL, Banque solde initial 150 000
    const principal = 100_000n;
    const initialBank = 150_000n;

    // Act 1: Premier versement de 30 000 (RP1)
    const repayment1 = 30_000n;
    assertCanRepayDebt(principal, repayment1);
    const remaining1 = computeDebtRemaining(principal, [repayment1]);
    const status1 = deriveSettlementStatus(principal, remaining1);

    expect(remaining1).toBe(70_000n);
    expect(status1).toBe('PARTIALLY_SETTLED');
    const bankAfter1 = initialBank - repayment1;
    expect(bankAfter1).toBe(120_000n);
    expect(bankAfter1 - remaining1).toBe(50_000n); // Position nette conservée à 50 000

    // Act 2: Second versement de 70 000 (RP2) soldant la dette
    const repayment2 = 70_000n;
    assertCanRepayDebt(remaining1, repayment2);
    const remaining2 = computeDebtRemaining(principal, [repayment1, repayment2]);
    const status2 = deriveSettlementStatus(principal, remaining2);

    expect(remaining2).toBe(0n);
    expect(status2).toBe('SETTLED');
    const bankAfter2 = bankAfter1 - repayment2;
    expect(bankAfter2).toBe(50_000n);
    expect(bankAfter2 - remaining2).toBe(50_000n); // Position nette = 50 000
  });

  it('[FIN-07-bis] Remboursement partiel d’une créance (RECEIVABLE)', () => {
    // Arrange: Créance 80 000 XOF, Wave solde initial 10 000
    const principal = 80_000n;
    const initialWave = 10_000n;

    // Act: Remboursement partiel reçu 30 000
    const receivedAmount = 30_000n;
    assertCanRepayDebt(principal, receivedAmount);
    const remaining = computeDebtRemaining(principal, [receivedAmount]);
    const status = deriveSettlementStatus(principal, remaining);

    expect(remaining).toBe(50_000n);
    expect(status).toBe('PARTIALLY_SETTLED');
    const waveAfter = initialWave + receivedAmount;
    expect(waveAfter).toBe(40_000n);
    // Position nette = Trésorerie (40 000) + Créance (50 000) = 90 000 (10 000 + 80 000)
    expect(waveAfter + remaining).toBe(90_000n);
  });

  it('[FIN-17] Sur-remboursement d’une dette (refusé)', () => {
    // Arrange: Dette avec restant 70 000
    const remaining = 70_000n;

    // Act & Assert: Tentative de remboursement de 75 000 -> refusée
    expect(() => {
      assertCanRepayDebt(remaining, 75_000n);
    }).toThrow(DomainError);
  });

  it('[FIN-20] Annulation d’un remboursement de dette : réouverture automatique du solde', () => {
    const principal = 100_000n;
    const repaymentsWithCancelled = [
      { amountMinor: 30_000n, transactionStatus: 'VALIDATED' as const },
      { amountMinor: 70_000n, transactionStatus: 'CANCELLED' as const }, // Transaction annulée
    ];

    // Seuls les remboursements dont la transaction est VALIDATED sont imputés (§6.3)
    const remaining = computeDebtRemaining(principal, repaymentsWithCancelled);
    const status = deriveSettlementStatus(principal, remaining);

    expect(remaining).toBe(70_000n);
    expect(status).toBe('PARTIALLY_SETTLED');
  });

  it('[FIN-37] Récurrence, prévision et idempotence (ancrage 31, fin de mois, prévision non dupliquée)', () => {
    // Arrange: Récurrence mensuelle ancrée au 31 janvier 2026
    const dates = generateOccurrences({
      recurrenceRule: 'FREQ=MONTHLY;INTERVAL=1',
      anchorDate: '2026-01-31',
      fromDate: '2026-01-31',
      toDate: '2026-04-30',
    });

    // 28 février (non bissextile), 31 mars, 30 avril
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);

    // Idempotence : recalculer génère exactement les mêmes dates
    const dates2 = generateOccurrences({
      recurrenceRule: 'FREQ=MONTHLY;INTERVAL=1',
      anchorDate: '2026-01-31',
      fromDate: '2026-01-31',
      toDate: '2026-04-30',
    });
    expect(dates2).toEqual(dates);

    // Prévision de trésorerie sur un compte Wave avec solde réalisé 200 000
    // 2 occurrences futures EXPECTED de 15 000
    const projection = projectAccountCashflow({
      accountId: '01928000-0000-7000-8000-000000000010',
      accountName: 'Compte Wave',
      currency: 'XOF',
      currentBalanceMinor: 200_000n,
      startDate: '2026-02-01',
      endDate: '2026-04-30',
      occurrences: [
        {
          dueOn: '2026-02-28',
          expectedAmountMinor: 15_000n,
          type: 'EXPENSE',
          status: 'EXPECTED',
        },
        {
          dueOn: '2026-03-31',
          expectedAmountMinor: 15_000n,
          type: 'EXPENSE',
          status: 'EXPECTED',
        },
        {
          dueOn: '2026-01-31',
          expectedAmountMinor: 15_000n,
          type: 'EXPENSE',
          status: 'CONFIRMED', // Confirmée : déjà dans le solde réalisé, exclue des prévisions
        },
      ],
      debts: [],
    });

    expect(projection.projectedEndBalanceMinor).toBe('170000');
    expect(projection.hasProjectedNegative).toBe(false);
  });

  it('[FIN-40] Dette manuelle sans trésorerie et radiation de créance (WRITTEN_OFF)', () => {
    // Arrange: Créance manuelle 50 000
    const principal = 50_000n;
    const remaining = computeDebtRemaining(principal, []);
    expect(remaining).toBe(50_000n);

    // Annulation refusée si des remboursements validés existent
    expect(() => {
      assertCanCancelDebt({
        status: 'OPEN',
        hasValidatedRepayments: true,
      });
    }).toThrow(DomainError);

    // Annulation autorisée si aucun remboursement validé
    expect(() => {
      assertCanCancelDebt({
        status: 'OPEN',
        hasValidatedRepayments: false,
      });
    }).not.toThrow();

    // Radiation autorisée uniquement pour RECEIVABLE, avec motif
    expect(() => {
      assertCanWriteOffDebt({
        type: 'RECEIVABLE',
        status: 'OPEN',
        reason: 'Client insolvable certifié',
      });
    }).not.toThrow();

    // Radiation interdite sur dette PAYABLE
    expect(() => {
      assertCanWriteOffDebt({
        type: 'PAYABLE',
        status: 'OPEN',
        reason: 'Tentative illégale',
      });
    }).toThrow(DomainError);
  });
});
