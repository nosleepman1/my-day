import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { allocate } from './allocate';
import { add, money, subtract, sum } from './money';
import { parseMinor, toMinorString } from './parse';

const LIMIT = 10n ** 15n;
const minorArb = fc.bigInt({ min: -LIMIT, max: LIMIT });
const ratiosArb = fc.array(fc.bigInt({ min: 0n, max: 1000n }), { minLength: 1, maxLength: 10 });

describe('money properties', () => {
  it('addition is commutative and subtraction is its inverse', () => {
    fc.assert(
      fc.property(minorArb, minorArb, (a, b) => {
        const x = money(a, 'XOF');
        const y = money(b, 'XOF');
        expect(add(x, y)).toEqual(add(y, x));
        expect(subtract(add(x, y), y)).toEqual(x);
      }),
    );
  });

  it('allocate preserves the total', () => {
    fc.assert(
      fc.property(minorArb, ratiosArb, (a, ratios) => {
        fc.pre(ratios.some((r) => r > 0n));
        const parts = allocate(money(a, 'XOF'), ratios);
        expect(sum('XOF', parts)).toEqual(money(a, 'XOF'));
      }),
    );
  });

  it('parseMinor and toMinorString round-trip', () => {
    fc.assert(
      fc.property(minorArb, (a) => {
        const value = money(a, 'EUR');
        expect(parseMinor(toMinorString(value), 'EUR')).toEqual(value);
      }),
    );
  });
});
