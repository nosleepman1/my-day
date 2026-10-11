import { describe, expect, it } from 'vitest';

import { roundHalfUp } from './rounding';

describe('roundHalfUp (FINANCE_RULES §2.2)', () => {
  it.each([
    [5994n, 100n, 60n],
    [5950n, 100n, 60n],
    [5949n, 100n, 59n],
    [0n, 7n, 0n],
    [10n, 5n, 2n],
    [-5950n, 100n, -60n],
    [-5949n, 100n, -59n],
  ])('roundHalfUp(%s, %s) = %s', (n, d, expected) => {
    expect(roundHalfUp(n, d)).toBe(expected);
  });

  it('rejects a non-positive divisor', () => {
    expect(() => roundHalfUp(1n, 0n)).toThrow(RangeError);
    expect(() => roundHalfUp(1n, -1n)).toThrow(RangeError);
  });
});
