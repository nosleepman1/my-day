/** Attente trop longue pour obtenir une place : le service est saturé. */
export class SemaphoreTimeoutError extends Error {
  override readonly name = 'SemaphoreTimeoutError';
}

interface Waiter {
  grant: () => void;
}

/**
 * Limite le nombre de tâches simultanées (hachages argon2id : 4 × 64 Mio, SECURITY.md §3.3).
 * Les tâches en surnombre attendent au plus `queueTimeoutMs`, puis échouent.
 */
export class Semaphore {
  private active = 0;
  private readonly waiters: Waiter[] = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly queueTimeoutMs: number,
  ) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        grant: () => {
          clearTimeout(timer);
          resolve();
        },
      };
      const timer = setTimeout(() => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(new SemaphoreTimeoutError(`No slot available within ${this.queueTimeoutMs} ms`));
      }, this.queueTimeoutMs);
      this.waiters.push(waiter);
    });
  }

  /** La place libérée passe directement au premier en attente ; sinon le compteur baisse. */
  private release(): void {
    const next = this.waiters.shift();
    if (next === undefined) {
      this.active -= 1;
      return;
    }
    next.grant();
  }
}
