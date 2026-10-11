import { describe, expect, it } from 'vitest';

import { assertCurrencyCode, CURRENCIES, exponentOf, isCurrencyCode } from './currency';
import { MoneyError } from './errors';

describe('currency', () => {
  it('declares XOF without decimals and EUR/USD with two (ADR-008)', () => {
    expect(exponentOf('XOF')).toBe(0);
    expect(exponentOf('EUR')).toBe(2);
    expect(exponentOf('USD')).toBe(2);
    expect(CURRENCIES.XOF.symbol).toBe('FCFA');
  });

  it('recognises supported ISO 4217 codes only', () => {
    expect(isCurrencyCode('XOF')).toBe(true);
    expect(isCurrencyCode('xof')).toBe(false);
    expect(isCurrencyCode('GBP')).toBe(false);
    expect(isCurrencyCode('toString')).toBe(false);
  });

  it('asserts a currency code or throws UNKNOWN_CURRENCY', () => {
    expect(assertCurrencyCode('EUR')).toBe('EUR');
    expect(() => assertCurrencyCode('ABC')).toThrow(MoneyError);
    expect(() => assertCurrencyCode('ABC')).toThrow(expect.objectContaining({ code: 'UNKNOWN_CURRENCY' }));
  });
});
