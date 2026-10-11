import { describe, expect, it } from 'vitest';

import { add, compare, isNegative, isPositive, isZero, money, negate, subtract, sum, zero } from './money';

const xof = (minor: bigint) => money(minor, 'XOF');

describe('money', () => {
  it('creates a frozen value object', () => {
    const value = xof(150_000n);
    expect(value).toEqual({ minor: 150_000n, currency: 'XOF' });
    expect(Object.isFrozen(value)).toBe(true);
  });

  it('rejects values outside the BIGINT range', () => {
    expect(() => xof(9_223_372_036_854_775_808n)).toThrow(
      expect.objectContaining({ code: 'AMOUNT_OUT_OF_RANGE' }),
    );
    expect(() => xof(-9_223_372_036_854_775_809n)).toThrow(
      expect.objectContaining({ code: 'AMOUNT_OUT_OF_RANGE' }),
    );
    expect(xof(9_223_372_036_854_775_807n).minor).toBe(9_223_372_036_854_775_807n);
  });

  it('adds and subtracts amounts of the same currency', () => {
    expect(add(xof(100_000n), xof(50_000n))).toEqual(xof(150_000n));
    expect(subtract(xof(100_000n), xof(130_000n))).toEqual(xof(-30_000n));
  });

  it('refuses to mix currencies (CURRENCY_MISMATCH)', () => {
    expect(() => add(xof(1n), money(1n, 'EUR'))).toThrow(
      expect.objectContaining({ code: 'CURRENCY_MISMATCH' }),
    );
    expect(() => compare(xof(1n), money(1n, 'EUR'))).toThrow(
      expect.objectContaining({ code: 'CURRENCY_MISMATCH' }),
    );
  });

  it('negates and compares', () => {
    expect(negate(xof(5n))).toEqual(xof(-5n));
    expect(compare(xof(1n), xof(2n))).toBe(-1);
    expect(compare(xof(2n), xof(2n))).toBe(0);
    expect(compare(xof(3n), xof(2n))).toBe(1);
  });

  it('reports sign predicates', () => {
    expect(isZero(zero('EUR'))).toBe(true);
    expect(isPositive(xof(1n))).toBe(true);
    expect(isPositive(xof(0n))).toBe(false);
    expect(isNegative(xof(-1n))).toBe(true);
    expect(isNegative(xof(0n))).toBe(false);
  });

  it('sums a list, starting from zero in the given currency', () => {
    expect(sum('XOF', [])).toEqual(xof(0n));
    expect(sum('XOF', [xof(50_000n), xof(60_000n), xof(40_000n)])).toEqual(xof(150_000n));
    expect(() => sum('XOF', [money(1n, 'EUR')])).toThrow(
      expect.objectContaining({ code: 'CURRENCY_MISMATCH' }),
    );
  });
});
