import { describe, expect, it } from 'vitest';

import { money } from './money';
import { convert, multiplyRate, toScaled } from './rate';

describe('toScaled', () => {
  it.each([
    ['655.957', 10, 6_559_570_000_000n],
    ['18', 4, 180_000n],
    ['0.0001', 4, 1n],
    ['1.5', 3, 1500n],
  ])('scales %s with %d digits', (value, scale, expected) => {
    expect(toScaled(value, scale)).toBe(expected);
  });

  it.each(['', '-1', '1.', '.5', 'abc', '1,5', '1e3'])('rejects %j', (value) => {
    expect(() => toScaled(value, 4)).toThrow(expect.objectContaining({ code: 'INVALID_DECIMAL' }));
  });

  it('rejects more fraction digits than the scale', () => {
    expect(() => toScaled('0.00001', 4)).toThrow(expect.objectContaining({ code: 'TOO_MANY_DECIMALS' }));
  });
});

describe('multiplyRate', () => {
  it('applies a decimal rate with a single half-up rounding', () => {
    expect(multiplyRate(money(333n, 'XOF'), '0.18')).toEqual(money(60n, 'XOF'));
    expect(multiplyRate(money(25n, 'XOF'), '0.18')).toEqual(money(5n, 'XOF'));
    expect(multiplyRate(money(-333n, 'XOF'), '0.18')).toEqual(money(-60n, 'XOF'));
  });
});

describe('convert', () => {
  it('converts EUR to XOF at a user-provided rate, rounding half-up once', () => {
    // 152,45 € × 655,957 = 100 000,64… FCFA → 100 001 FCFA
    expect(convert(money(15_245n, 'EUR'), 'XOF', '655.957')).toEqual(money(100_001n, 'XOF'));
  });

  it('converts XOF to EUR with half-up rounding', () => {
    expect(convert(money(100_000n, 'XOF'), 'EUR', '0.0015244902')).toEqual(money(15_245n, 'EUR'));
  });

  it('rejects a rate that is not strictly positive', () => {
    expect(() => convert(money(1n, 'EUR'), 'XOF', '0')).toThrow(
      expect.objectContaining({ code: 'INVALID_DECIMAL' }),
    );
  });
});
