import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';

import { DomainError } from '../errors/domain-error';
import { defaultMessageOf } from '../http/error-mapping';

import { type Argon2Params, formatArgon2idPhc, parseArgon2idPhc } from './argon2-phc';
import type { PasswordHasherPort } from './password-hasher.port';
import { Semaphore, SemaphoreTimeoutError } from './semaphore';

export type { Argon2Params } from './argon2-phc';
export type HashingLimits = Readonly<{ maxConcurrent: number; queueTimeoutMs: number }>;

/** ADR-006 : argon2id, m = 64 Mio, t = 3, p = 1 (à recalibrer sur le VPS en PHASE-03). */
export const PRODUCTION_ARGON2_PARAMS: Argon2Params = { memoryCost: 65_536, timeCost: 3, parallelism: 1 };
/** SECURITY.md §3.3 : 4 hachages simultanés, 2 s d'attente au plus, puis 503. */
export const DEFAULT_HASHING_LIMITS: HashingLimits = { maxConcurrent: 4, queueTimeoutMs: 2_000 };

const SALT_LENGTH_BYTES = 16;
const DIGEST_LENGTH_BYTES = 32;
const DUMMY_PASSWORD = 'orbit-dummy-password-never-valid';

/** argon2id de Node (`crypto.argon2`, pool de threads libuv) : aucun module natif tiers à charger. */
function deriveArgon2id(
  password: string,
  salt: Buffer,
  params: Argon2Params,
  digestLength: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2(
      'argon2id',
      {
        message: password.normalize('NFC'),
        nonce: salt,
        memory: params.memoryCost,
        passes: params.timeCost,
        parallelism: params.parallelism,
        tagLength: digestLength,
      },
      (error, derived) => {
        if (error) reject(error);
        else resolve(derived);
      },
    );
  });
}

/** Adaptateur argon2id du port de hachage : NFC, sel aléatoire, format PHC, concurrence bornée. */
export class Argon2PasswordHasher implements PasswordHasherPort {
  private readonly semaphore: Semaphore;
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly params: Argon2Params = PRODUCTION_ARGON2_PARAMS,
    limits: HashingLimits = DEFAULT_HASHING_LIMITS,
  ) {
    this.semaphore = new Semaphore(limits.maxConcurrent, limits.queueTimeoutMs);
  }

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH_BYTES);
    const digest = await this.bounded(() => deriveArgon2id(password, salt, this.params, DIGEST_LENGTH_BYTES));
    return formatArgon2idPhc(this.params, salt, digest);
  }

  async verify(storedHash: string, password: string): Promise<boolean> {
    // Empreinte illisible : refus silencieux, jamais d'exception visible par le client.
    const parsed = parseArgon2idPhc(storedHash);
    if (parsed === null) return false;
    const { params, salt, digest } = parsed;
    const candidate = await this.bounded(() => deriveArgon2id(password, salt, params, digest.length));
    return timingSafeEqual(candidate, digest);
  }

  async verifyAgainstDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash(DUMMY_PASSWORD).catch((error: unknown) => {
      // Sémaphore saturé : ne pas mémoriser l'échec, sinon chaque adresse inconnue répondrait 503 (oracle).
      this.dummyHash = undefined;
      throw error;
    });
    await this.verify(await this.dummyHash, password);
    return false;
  }

  needsRehash(storedHash: string): boolean {
    const parsed = parseArgon2idPhc(storedHash);
    if (parsed === null) return true;
    const { memoryCost, timeCost, parallelism } = parsed.params;
    return (
      memoryCost !== this.params.memoryCost ||
      timeCost !== this.params.timeCost ||
      parallelism !== this.params.parallelism ||
      parsed.digest.length !== DIGEST_LENGTH_BYTES
    );
  }

  private async bounded<T>(task: () => Promise<T>): Promise<T> {
    try {
      return await this.semaphore.run(task);
    } catch (error: unknown) {
      if (error instanceof SemaphoreTimeoutError) {
        throw new DomainError('SERVICE_UNAVAILABLE', defaultMessageOf('SERVICE_UNAVAILABLE'));
      }
      throw error;
    }
  }
}
