import { describe, expect, it } from 'vitest';

import { money } from './money';
import { parseMinor, parsePositiveAmount, parseUserInput, toMinorString } from './parse';

describe('parseMinor (API wire format, ADR-008)', () => {
  it.each([
    ['150000', 150_000n],
    ['0', 0n],
    ['-30000', -30_000n],
    ['9223372036854775807', 9_223_372_036_854_775_807n],
  ])('parses %s', (input, expected) => {
    expect(parseMinor(input, 'XOF')).toEqual(money(expected, 'XOF'));
  });

  it.each(['', ' 1', '1 ', '+1', '01', '-0', '1.5', '1e3', '1,000', 'abc', '--1'])('rejects %j', (input) => {
    expect(() => parseMinor(input, 'XOF')).toThrow(expect.objectContaining({ code: 'INVALID_AMOUNT' }));
  });

  it('rejects values outside the BIGINT range', () => {
    expect(() => parseMinor('9223372036854775808', 'XOF')).toThrow(
      expect.objectContaining({ code: 'AMOUNT_OUT_OF_RANGE' }),
    );
  });

  it('round-trips through toMinorString', () => {
    expect(toMinorString(money(-1050n, 'EUR'))).toBe('-1050');
    expect(toMinorString(parseMinor('150000', 'XOF'))).toBe('150000');
  });
});

describe('parsePositiveAmount (entered amounts)', () => {
  it('accepts strictly positive amounts up to 10^18', () => {
    expect(parsePositiveAmount('1', 'XOF').minor).toBe(1n);
    expect(parsePositiveAmount('1000000000000000000', 'XOF').minor).toBe(10n ** 18n);
  });

  it.each(['0', '-5000', '0.5'])('rejects %j as INVALID_AMOUNT', (input) => {
    expect(() => parsePositiveAmount(input, 'XOF')).toThrow(
      expect.objectContaining({ code: 'INVALID_AMOUNT' }),
    );
  });

  it('rejects amounts above 10^18 as AMOUNT_OUT_OF_RANGE', () => {
    expect(() => parsePositiveAmount('1000000000000000001', 'XOF')).toThrow(
      expect.objectContaining({ code: 'AMOUNT_OUT_OF_RANGE' }),
    );
  });
});

describe('parseUserInput (form input)', () => {
  it.each([
    ['150000', 'XOF', 150_000n],
    ['150 000', 'XOF', 150_000n],
    ['1\u202F250\u00A0000', 'XOF', 1_250_000n],
    ['12,50', 'EUR', 1250n],
    ['12.5', 'EUR', 1250n],
    ['12', 'EUR', 1200n],
    ['0,05', 'EUR', 5n],
    ['-3,10', 'EUR', -310n],
  ] as const)('parses %j in %s', (input, currency, expected) => {
    expect(parseUserInput(input, currency)).toEqual(money(expected, currency));
  });

  it('refuses more decimals than the currency allows, never rounding (FINANCE_RULES §2.1)', () => {
    expect(() => parseUserInput('0,5', 'XOF')).toThrow(
      expect.objectContaining({ code: 'TOO_MANY_DECIMALS' }),
    );
    expect(() => parseUserInput('1,005', 'EUR')).toThrow(
      expect.objectContaining({ code: 'TOO_MANY_DECIMALS' }),
    );
  });

  it.each(['', 'abc', '1,2,3', '12,', ',5', '1e3', '--1'])('rejects %j', (input) => {
    expect(() => parseUserInput(input, 'EUR')).toThrow(expect.objectContaining({ code: 'INVALID_AMOUNT' }));
  });
});
