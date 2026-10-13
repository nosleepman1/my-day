import { describe, expect, it, vi } from 'vitest';

import { enforceMinimumDuration } from './minimum-duration';

function timeline(...instants: number[]): () => number {
  const queue = [...instants];
  return () => queue.shift() ?? 0;
}

describe('enforceMinimumDuration', () => {
  it('waits for the remaining time when the task is faster than the floor', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await enforceMinimumDuration(() => Promise.resolve('ok'), 750, {
      now: timeline(1_000, 1_100),
      sleep,
    });

    expect(result).toBe('ok');
    expect(sleep).toHaveBeenCalledWith(650);
  });

  it('does not wait when the task already took longer than the floor', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);

    await enforceMinimumDuration(() => Promise.resolve(1), 750, { now: timeline(0, 900), sleep });

    expect(sleep).not.toHaveBeenCalled();
  });

  it('pads failures too, then rethrows the original error', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const failure = new Error('boom');

    await expect(
      enforceMinimumDuration(() => Promise.reject(failure), 500, { now: timeline(0, 100), sleep }),
    ).rejects.toBe(failure);
    expect(sleep).toHaveBeenCalledWith(400);
  });

  it('is a no-op with a zero floor (tests)', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);

    await enforceMinimumDuration(() => Promise.resolve(), 0, { now: timeline(0, 5), sleep });

    expect(sleep).not.toHaveBeenCalled();
  });

  it('really sleeps with the default timer', async () => {
    const started = performance.now();

    await enforceMinimumDuration(() => Promise.resolve(), 30);

    expect(performance.now() - started).toBeGreaterThanOrEqual(25);
  });
});
