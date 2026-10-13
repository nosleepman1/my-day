import { describe, expect, it } from 'vitest';

import { Semaphore, SemaphoreTimeoutError } from './semaphore';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('Semaphore', () => {
  it('runs at most N tasks at once and queues the rest', async () => {
    const semaphore = new Semaphore(2, 1_000);
    const gates = [deferred(), deferred(), deferred()];
    let running = 0;
    let peak = 0;
    const tasks = gates.map((gate) =>
      semaphore.run(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await gate.promise;
        running -= 1;
      }),
    );
    await Promise.resolve();
    for (const gate of gates) gate.resolve();
    await Promise.all(tasks);
    expect(peak).toBe(2);
  });

  it('rejects a waiting task after the queue timeout', async () => {
    const semaphore = new Semaphore(1, 20);
    const gate = deferred();
    const first = semaphore.run(() => gate.promise);
    await expect(semaphore.run(() => Promise.resolve())).rejects.toBeInstanceOf(SemaphoreTimeoutError);
    gate.resolve();
    await first;
  });

  it('releases the slot when a task fails', async () => {
    const semaphore = new Semaphore(1, 100);
    await expect(semaphore.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(semaphore.run(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });
});
