import { describe, expect, it } from 'vitest';

import { assertCurrencyCode, CURRENCIES, exponentOf, isCurrencyCode } from './currency';
import { MoneyError } from './errors';

describe('currency', () => {
  it('declares XOF, XAF, GNF without decimals and others with two (ADR-008)', () => {
    expect(exponentOf('XOF')).toBe(0);
    expect(exponentOf('XAF')).toBe(0);
    expect(exponentOf('GNF')).toBe(0);
    expect(exponentOf('EUR')).toBe(2);
    expect(exponentOf('USD')).toBe(2);
    expect(exponentOf('GBP')).toBe(2);
    expect(CURRENCIES.XOF.symbol).toBe('FCFA');
    expect(CURRENCIES.XAF.symbol).toBe('FCFA');
    expect(CURRENCIES.GNF.symbol).toBe('FG');
    expect(CURRENCIES.GBP.symbol).toBe('£');
  });

  it('recognises supported ISO 4217 codes only', () => {
    expect(isCurrencyCode('XOF')).toBe(true);
    expect(isCurrencyCode('GBP')).toBe(true);
    expect(isCurrencyCode('xof')).toBe(false);
    expect(isCurrencyCode('JPY')).toBe(false);
    expect(isCurrencyCode('toString')).toBe(false);
  });

  it('asserts a currency code or throws UNKNOWN_CURRENCY', () => {
    expect(assertCurrencyCode('EUR')).toBe('EUR');
    expect(assertCurrencyCode('GBP')).toBe('GBP');
    expect(() => assertCurrencyCode('ABC')).toThrow(MoneyError);
    expect(() => assertCurrencyCode('ABC')).toThrow(expect.objectContaining({ code: 'UNKNOWN_CURRENCY' }));
  });
});
