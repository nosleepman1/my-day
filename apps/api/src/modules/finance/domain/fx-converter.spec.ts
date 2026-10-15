import { describe, expect, it } from 'vitest';

import { DomainError } from '../../../platform/errors/domain-error';

import { assertDestinationAmountMatches, convertCurrency } from './fx-converter';

describe('fx-converter (FINANCE_RULES §2.2, §6)', () => {
  it('returns same amount when currencies are identical', () => {
    expect(convertCurrency(50_000n, 'XOF', 'XOF', '1')).toBe(50_000n);
    expect(() => {
      assertDestinationAmountMatches({
        srcMinor: 50_000n,
        srcCurrency: 'XOF',
        destMinor: 50_000n,
        destCurrency: 'XOF',
      });
    }).not.toThrow();
  });

  it('rejects mismatch in same currency transfer', () => {
    expect(() => {
      assertDestinationAmountMatches({
        srcMinor: 50_000n,
        srcCurrency: 'XOF',
        destMinor: 50_001n,
        destCurrency: 'XOF',
      });
    }).toThrow(DomainError);
  });

  it('converts EUR to XOF using exact rate (1 EUR = 655.957 XOF)', () => {
    // 100 EUR = 10 000 centimes.
    // 100 * 655.957 = 65 595.7 -> half-up = 65 596 XOF (0 decimals)
    const converted = convertCurrency(10_000n, 'EUR', 'XOF', '655.957');
    expect(converted).toBe(65_596n);
  });

  it('converts XOF to EUR using rate (1 XOF = 0.0015244901 EUR)', () => {
    // 65 596 XOF * 0.0015244901 = 99.99965... EUR -> 100.00 EUR = 10000 centimes
    const converted = convertCurrency(65_596n, 'XOF', 'EUR', '0.0015244901');
    expect(converted).toBe(10_000n);
  });

  it('accepts destination amount within ±1 minor unit tolerance', () => {
    // Expected is 65596
    expect(() => {
      assertDestinationAmountMatches({
        srcMinor: 10_000n,
        srcCurrency: 'EUR',
        destMinor: 65_596n,
        destCurrency: 'XOF',
        rateString: '655.957',
      });
    }).not.toThrow();
    expect(() => {
      assertDestinationAmountMatches({
        srcMinor: 10_000n,
        srcCurrency: 'EUR',
        destMinor: 65_597n,
        destCurrency: 'XOF',
        rateString: '655.957',
      });
    }).not.toThrow();
    expect(() => {
      assertDestinationAmountMatches({
        srcMinor: 10_000n,
        srcCurrency: 'EUR',
        destMinor: 65_595n,
        destCurrency: 'XOF',
        rateString: '655.957',
      });
    }).not.toThrow();

    // 2 minor units diff -> rejected
    expect(() => {
      assertDestinationAmountMatches({
        srcMinor: 10_000n,
        srcCurrency: 'EUR',
        destMinor: 65_598n,
        destCurrency: 'XOF',
        rateString: '655.957',
      });
    }).toThrow(DomainError);
    expect(() => {
      assertDestinationAmountMatches({
        srcMinor: 10_000n,
        srcCurrency: 'EUR',
        destMinor: 65_594n,
        destCurrency: 'XOF',
        rateString: '655.957',
      });
    }).toThrow(DomainError);
  });

  it('rejects invalid, negative or zero exchange rate', () => {
    expect(() => convertCurrency(10_000n, 'EUR', 'XOF', '0')).toThrow(DomainError);
    expect(() => convertCurrency(10_000n, 'EUR', 'XOF', '-1.5')).toThrow(DomainError);
    expect(() => convertCurrency(10_000n, 'EUR', 'XOF', 'invalid')).toThrow(DomainError);
  });

  it('requires exchange rate for different currencies in assertDestinationAmountMatches', () => {
    expect(() => {
      assertDestinationAmountMatches({
        srcMinor: 10_000n,
        srcCurrency: 'EUR',
        destMinor: 65_596n,
        destCurrency: 'XOF',
      });
    }).toThrow(DomainError);
  });
});
