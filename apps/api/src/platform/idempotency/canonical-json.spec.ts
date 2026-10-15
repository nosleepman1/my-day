import { describe, expect, it } from 'vitest';

import { canonicalJsonHash, canonicalJsonString } from './canonical-json';

describe('canonical-json', () => {
  it('serializes primitives consistently', () => {
    expect(canonicalJsonString('hello')).toBe('"hello"');
    expect(canonicalJsonString(123)).toBe('123');
    expect(canonicalJsonString(true)).toBe('true');
    expect(canonicalJsonString(null)).toBe('null');
  });

  it('sorts object keys alphabetically', () => {
    const obj1 = { b: 2, a: 1, c: { y: 20, x: 10 } };
    const obj2 = { c: { x: 10, y: 20 }, a: 1, b: 2 };

    expect(canonicalJsonString(obj1)).toBe('{"a":1,"b":2,"c":{"x":10,"y":20}}');
    expect(canonicalJsonString(obj2)).toBe('{"a":1,"b":2,"c":{"x":10,"y":20}}');
    expect(canonicalJsonHash(obj1).equals(canonicalJsonHash(obj2))).toBe(true);
  });

  it('produces different hashes for different objects', () => {
    const hash1 = canonicalJsonHash({ amount: '1000' });
    const hash2 = canonicalJsonHash({ amount: '2000' });
    expect(hash1.equals(hash2)).toBe(false);
  });

  it('handles arrays preserving order', () => {
    expect(canonicalJsonString([1, 2, 3])).toBe('[1,2,3]');
  });
});
