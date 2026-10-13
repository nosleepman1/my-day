import { describe, expect, it } from 'vitest';

import { FixedClock } from './fixed-clock';
import { SystemClock } from './system-clock';

const START = new Date('2026-10-12T09:30:00.000Z');

describe('FixedClock', () => {
  it('returns the configured instant as a fresh copy', () => {
    const clock = new FixedClock(START);
    const first = clock.now();
    first.setUTCFullYear(1999);

    expect(clock.now().toISOString()).toBe('2026-10-12T09:30:00.000Z');
  });

  it('moves forward with advance() and can be set explicitly', () => {
    const clock = new FixedClock(START);

    clock.advance(25 * 60 * 60 * 1_000);
    expect(clock.now().toISOString()).toBe('2026-10-13T10:30:00.000Z');

    clock.set(new Date('2027-01-01T00:00:00.000Z'));
    expect(clock.now().toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('SystemClock', () => {
  it('returns the current instant', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});
