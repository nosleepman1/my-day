import { describe, expect, it } from 'vitest';

import { allocate } from './allocate';
import { money } from './money';

const xof = (minor: bigint) => money(minor, 'XOF');

describe('allocate', () => {
  it('splits without losing a unit, remainder to the largest fractions first', () => {
    expect(allocate(xof(100n), [1n, 1n, 1n])).toEqual([xof(34n), xof(33n), xof(33n)]);
    expect(allocate(xof(5n), [3n, 7n])).toEqual([xof(2n), xof(3n)]);
    expect(allocate(xof(10n), [1n, 2n])).toEqual([xof(3n), xof(7n)]);
  });

  it('handles zero ratios and negative amounts', () => {
    expect(allocate(xof(10n), [0n, 1n])).toEqual([xof(0n), xof(10n)]);
    expect(allocate(xof(-100n), [1n, 1n, 1n])).toEqual([xof(-34n), xof(-33n), xof(-33n)]);
  });

  it.each([[[]], [[0n, 0n]], [[1n, -1n]]])('rejects invalid ratios %o', (ratios) => {
    expect(() => allocate(xof(1n), ratios)).toThrow(expect.objectContaining({ code: 'INVALID_RATIOS' }));
  });
});
