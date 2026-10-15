import { describe, expect, it } from 'vitest';

import { assertValidAdjustment, calculateReconciliation } from './adjustment-rules';

describe('adjustment-rules domain', () => {
  describe('assertValidAdjustment', () => {
    it('accepts valid CREDIT adjustment', () => {
      expect(() => {
        assertValidAdjustment({
          amountMinor: 1000n,
          direction: 'CREDIT',
          reason: 'Correction solde caisse',
        });
      }).not.toThrow();
    });

    it('accepts valid DEBIT adjustment', () => {
      expect(() => {
        assertValidAdjustment({
          amountMinor: 500n,
          direction: 'DEBIT',
          reason: 'Régularisation frais non comptabilisés',
        });
      }).not.toThrow();
    });

    it('rejects zero amount (FIN-xx / FINANCE_RULES §4.4)', () => {
      expect(() => {
        assertValidAdjustment({
          amountMinor: 0n,
          direction: 'CREDIT',
          reason: 'Ajustement nul',
        });
      }).toThrow(/strictement positif/);
    });

    it('rejects negative amount', () => {
      expect(() => {
        assertValidAdjustment({
          amountMinor: -100n,
          direction: 'DEBIT',
          reason: 'Ajustement négatif',
        });
      }).toThrow(/strictement positif/);
    });

    it('rejects empty or whitespace reason (FINANCE_RULES §4.1)', () => {
      expect(() => {
        assertValidAdjustment({
          amountMinor: 1000n,
          direction: 'CREDIT',
          reason: '   ',
        });
      }).toThrow(/motif.*obligatoire/i);
    });
  });

  describe('calculateReconciliation', () => {
    it('returns balanced when cleared equals statement balance', () => {
      const result = calculateReconciliation(100000n, 100000n);
      expect(result.isBalanced).toBe(true);
      expect(result.differenceMinor).toBe(0n);
      expect(result.adjustmentNeeded).toBeNull();
    });

    it('calculates credit adjustment when statement is higher than cleared balance', () => {
      const result = calculateReconciliation(100000n, 105000n);
      expect(result.isBalanced).toBe(false);
      expect(result.differenceMinor).toBe(5000n);
      expect(result.adjustmentNeeded).toEqual({
        direction: 'CREDIT',
        amountMinor: 5000n,
      });
    });

    it('calculates debit adjustment when statement is lower than cleared balance', () => {
      const result = calculateReconciliation(100000n, 92000n);
      expect(result.isBalanced).toBe(false);
      expect(result.differenceMinor).toBe(-8000n);
      expect(result.adjustmentNeeded).toEqual({
        direction: 'DEBIT',
        amountMinor: 8000n,
      });
    });

    it('handles negative balances correctly', () => {
      const result = calculateReconciliation(-5000n, 0n);
      expect(result.isBalanced).toBe(false);
      expect(result.differenceMinor).toBe(5000n);
      expect(result.adjustmentNeeded).toEqual({
        direction: 'CREDIT',
        amountMinor: 5000n,
      });
    });
  });
});
