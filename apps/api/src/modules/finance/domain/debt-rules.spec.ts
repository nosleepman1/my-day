import { describe, expect, it } from 'vitest';

import {
  assertCanCancelDebt,
  assertCanRepayDebt,
  assertCanWriteOffDebt,
  computeDebtRemaining,
  deriveSettlementStatus,
  isDebtOverdue,
  validateRepaymentAmount,
} from './debt-rules';

describe('debt-rules domain', () => {
  describe('computeDebtRemaining', () => {
    it('returns principal when there are no repayments', () => {
      const remaining = computeDebtRemaining(100_000n, []);
      expect(remaining).toBe(100_000n);
    });

    it('subtracts only VALIDATED repayments', () => {
      const repayments = [
        { amountMinor: 30_000n, transactionStatus: 'VALIDATED' as const },
        { amountMinor: 20_000n, transactionStatus: 'CANCELLED' as const },
        { amountMinor: 10_000n, transactionStatus: 'PENDING' as const },
      ];
      const remaining = computeDebtRemaining(100_000n, repayments);
      expect(remaining).toBe(70_000n);
    });

    it('returns 0n when fully repaid', () => {
      const repayments = [
        { amountMinor: 50_000n, transactionStatus: 'VALIDATED' as const },
        { amountMinor: 50_000n, transactionStatus: 'VALIDATED' as const },
      ];
      const remaining = computeDebtRemaining(100_000n, repayments);
      expect(remaining).toBe(0n);
    });

    it('does not return negative numbers if repayments exceed principal', () => {
      const repayments = [{ amountMinor: 150_000n, transactionStatus: 'VALIDATED' as const }];
      const remaining = computeDebtRemaining(100_000n, repayments);
      expect(remaining).toBe(0n);
    });
  });

  describe('deriveSettlementStatus', () => {
    it('returns UNPAID when remaining equals principal', () => {
      expect(deriveSettlementStatus(100_000n, 100_000n)).toBe('UNPAID');
    });

    it('returns PARTIALLY_SETTLED when partly repaid', () => {
      expect(deriveSettlementStatus(100_000n, 70_000n)).toBe('PARTIALLY_SETTLED');
    });

    it('returns SETTLED when remaining is zero', () => {
      expect(deriveSettlementStatus(100_000n, 0n)).toBe('SETTLED');
    });
  });

  describe('isDebtOverdue', () => {
    const TODAY = '2026-10-15';

    it('returns true when dueDate is in the past, remaining > 0, and status is OPEN', () => {
      expect(
        isDebtOverdue({
          dueDate: '2026-10-14',
          remainingMinor: 50_000n,
          status: 'OPEN',
          todayCivil: TODAY,
        }),
      ).toBe(true);
    });

    it('returns false when dueDate is today (ADR-020: same day is not overdue)', () => {
      expect(
        isDebtOverdue({
          dueDate: TODAY,
          remainingMinor: 50_000n,
          status: 'OPEN',
          todayCivil: TODAY,
        }),
      ).toBe(false);
    });

    it('returns false when dueDate is in the future', () => {
      expect(
        isDebtOverdue({
          dueDate: '2026-10-20',
          remainingMinor: 50_000n,
          status: 'OPEN',
          todayCivil: TODAY,
        }),
      ).toBe(false);
    });

    it('returns false when dueDate is null', () => {
      expect(
        isDebtOverdue({
          dueDate: null,
          remainingMinor: 50_000n,
          status: 'OPEN',
          todayCivil: TODAY,
        }),
      ).toBe(false);
    });

    it('returns false when remainingMinor is zero (already settled)', () => {
      expect(
        isDebtOverdue({
          dueDate: '2026-10-01',
          remainingMinor: 0n,
          status: 'OPEN',
          todayCivil: TODAY,
        }),
      ).toBe(false);
    });

    it('returns false when status is CANCELLED or WRITTEN_OFF (terminal status)', () => {
      expect(
        isDebtOverdue({
          dueDate: '2026-10-01',
          remainingMinor: 50_000n,
          status: 'CANCELLED',
          todayCivil: TODAY,
        }),
      ).toBe(false);

      expect(
        isDebtOverdue({
          dueDate: '2026-10-01',
          remainingMinor: 50_000n,
          status: 'WRITTEN_OFF',
          todayCivil: TODAY,
        }),
      ).toBe(false);
    });
  });

  describe('validateRepaymentAmount', () => {
    it('accepts repayment equal to or less than remaining', () => {
      expect(validateRepaymentAmount(50_000n, 30_000n).valid).toBe(true);
      expect(validateRepaymentAmount(50_000n, 50_000n).valid).toBe(true);
    });

    it('refuses repayment strictly exceeding remaining', () => {
      const result = validateRepaymentAmount(50_000n, 60_000n);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('OVERPAYMENT_REFUSED');
    });

    it('refuses non-positive repayment amounts', () => {
      expect(validateRepaymentAmount(50_000n, 0n).valid).toBe(false);
      expect(validateRepaymentAmount(50_000n, -10_000n).valid).toBe(false);
    });
  });

  describe('assertCanRepayDebt', () => {
    it('accepts valid repayment within remaining', () => {
      expect(() => {
        assertCanRepayDebt(50_000n, 30_000n);
      }).not.toThrow();
    });

    it('throws DomainError on overpayment', () => {
      expect(() => {
        assertCanRepayDebt(50_000n, 60_000n);
      }).toThrow('Le montant du remboursement dépasse le restant dû.');
    });

    it('throws DomainError on non-positive amount', () => {
      expect(() => {
        assertCanRepayDebt(50_000n, 0n);
      }).toThrow('Le montant du remboursement doit être strictement positif.');
    });
  });

  describe('assertCanCancelDebt', () => {
    it('accepts cancellation of OPEN debt without validated repayments', () => {
      expect(() => {
        assertCanCancelDebt({ status: 'OPEN', hasValidatedRepayments: false });
      }).not.toThrow();
    });

    it('throws DomainError if debt is not OPEN', () => {
      expect(() => {
        assertCanCancelDebt({ status: 'CANCELLED', hasValidatedRepayments: false });
      }).toThrow("La dette n'est plus ouverte.");
    });

    it('throws DomainError if debt has validated repayments', () => {
      expect(() => {
        assertCanCancelDebt({ status: 'OPEN', hasValidatedRepayments: true });
      }).toThrow("Impossible d'annuler une dette ayant des remboursements validés.");
    });
  });

  describe('assertCanWriteOffDebt', () => {
    it('accepts write off for RECEIVABLE with valid reason', () => {
      expect(() => {
        assertCanWriteOffDebt({ type: 'RECEIVABLE', status: 'OPEN', reason: 'Client introuvable' });
      }).not.toThrow();
    });

    it('throws DomainError if type is PAYABLE', () => {
      expect(() => {
        assertCanWriteOffDebt({ type: 'PAYABLE', status: 'OPEN', reason: 'Défaut' });
      }).toThrow('Seule une créance peut être passée en perte.');
    });

    it('throws DomainError if status is not OPEN', () => {
      expect(() => {
        assertCanWriteOffDebt({ type: 'RECEIVABLE', status: 'WRITTEN_OFF', reason: 'Défaut' });
      }).toThrow("La dette n'est plus ouverte.");
    });

    it('throws DomainError if reason is blank', () => {
      expect(() => {
        assertCanWriteOffDebt({ type: 'RECEIVABLE', status: 'OPEN', reason: '   ' });
      }).toThrow('Un motif est requis pour passer la créance en perte.');
    });
  });
});
