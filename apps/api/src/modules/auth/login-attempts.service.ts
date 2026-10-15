import { setTimeout as sleepFor } from 'node:timers/promises';

import { Inject, Injectable } from '@nestjs/common';

import { Pseudonymizer } from '../../platform/auth/pseudonymizer';
import type { Env } from '../../platform/config/env.schema';
import { DomainError } from '../../platform/errors/domain-error';
import type { ClientContext } from '../../platform/http/client-context';
import { defaultMessageOf } from '../../platform/http/error-mapping';
import { CLOCK, type ClockPort } from '../../platform/time/clock.port';

import { AccountMailer } from './account-mailer.service';
import type { FailureStats } from './login-events.repository';
import { type JournalEntry, LoginJournal } from './login-journal.service';

export type { FailureStats } from './login-events.repository';

/** Jeton d'injection de la politique de tentatives (dérivée de la configuration). */
export const LOGIN_ATTEMPTS_POLICY = Symbol('LOGIN_ATTEMPTS_POLICY');

export type LoginAttemptsPolicy = Readonly<{
  /** Délai progressif par échec récent (250 ms) ; 0 dans les tests. */
  delayUnitMs: number;
  digestEmail: (normalizedEmail: string) => Buffer;
  sleep: (milliseconds: number) => Promise<unknown>;
}>;

export function loginAttemptsPolicyFrom(env: Env): LoginAttemptsPolicy {
  const pseudonymizer = new Pseudonymizer(env.RATE_LIMIT_HMAC_KEY);
  return {
    delayUnitMs: env.LOGIN_DELAY_UNIT_MS,
    digestEmail: (email) => pseudonymizer.digest(email),
    sleep: (milliseconds) => sleepFor(milliseconds),
  };
}

export type FailureCode = 'INVALID_CREDENTIALS' | 'ACCOUNT_INACTIVE' | 'EMAIL_NOT_VERIFIED';
export type FailureInput = Readonly<{ userId: string | null; emailHmac: Buffer; failureCode: FailureCode }>;

interface AttemptsJournal {
  record(entry: JournalEntry): Promise<void>;
  failureStats(emailHmac: Buffer, now: Date): Promise<FailureStats>;
}

interface LockAlertMailer {
  sendLoginLocked(to: string, occurredAt: Date): Promise<void>;
}

/** SECURITY.md §3.7 : 10 échecs/h → 15 min ; 50 échecs/24 h → 24 h + alerte ; délai après 3 échecs. */
const SHORT_LOCK = { threshold: 10, durationMs: 15 * 60_000 } as const;
const LONG_LOCK = { threshold: 50, durationMs: 24 * 3_600_000 } as const;
const DELAY_AFTER_FAILURES = 3;
const MAX_DELAY_MS = 2_000;

function lockExpiry(stats: FailureStats): Date | null {
  if (stats.latestAt === null) return null;
  const latest = stats.latestAt.getTime();
  if (stats.lastDay >= LONG_LOCK.threshold) return new Date(latest + LONG_LOCK.durationMs);
  if (stats.lastHour >= SHORT_LOCK.threshold) return new Date(latest + SHORT_LOCK.durationMs);
  return null;
}

/**
 * Verrouillage persistant des connexions, calculé depuis `login_events` et indexé par le HMAC de l'adresse
 * saisie : il s'applique que le compte existe ou non (réponse indistinguable, SECURITY.md §3.8).
 */
@Injectable()
export class LoginAttempts {
  constructor(
    @Inject(LoginJournal) private readonly journal: AttemptsJournal,
    @Inject(AccountMailer) private readonly mailer: LockAlertMailer,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(LOGIN_ATTEMPTS_POLICY) private readonly policy: LoginAttemptsPolicy,
  ) {}

  /**
   * Refuse une adresse verrouillée (429), sinon ralentit après 3 échecs récents.
   * @returns le HMAC de l'adresse, à enregistrer avec chaque événement de connexion.
   */
  async assertAllowed(normalizedEmail: string, client: ClientContext): Promise<Buffer> {
    const emailHmac = this.policy.digestEmail(normalizedEmail);
    const now = this.clock.now();
    const stats = await this.journal.failureStats(emailHmac, now);
    const lockedUntil = lockExpiry(stats);
    if (lockedUntil !== null && lockedUntil.getTime() > now.getTime()) {
      await this.journal.record({
        eventType: 'LOGIN_FAILED',
        userId: null,
        emailHmac,
        failureCode: 'LOCKED',
        ip: client.ip,
        userAgentLabel: client.userAgent,
      });
      const retryAfterSeconds = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1_000);
      throw new DomainError('RATE_LIMITED', defaultMessageOf('RATE_LIMITED'), { retryAfterSeconds });
    }
    const delayMs = Math.min(this.policy.delayUnitMs * stats.lastHour, MAX_DELAY_MS);
    if (stats.lastHour >= DELAY_AFTER_FAILURES && delayMs > 0) await this.policy.sleep(delayMs);
    return emailHmac;
  }

  /**
   * Seuls les mots de passe faux comptent pour le verrouillage. Au seuil, `ACCOUNT_LOCKED` est journalisé ;
   * au seuil de 24 h, le titulaire (`alertTo`, compte existant) est prévenu par e-mail.
   */
  async recordFailure(input: FailureInput, client: ClientContext, alertTo: string | null): Promise<void> {
    const origin = { ip: client.ip, userAgentLabel: client.userAgent };
    await this.journal.record({ eventType: 'LOGIN_FAILED', ...input, ...origin });
    if (input.failureCode !== 'INVALID_CREDENTIALS') return;
    const now = this.clock.now();
    const stats = await this.journal.failureStats(input.emailHmac, now);
    const reachesLongLock = stats.lastDay === LONG_LOCK.threshold;
    if (stats.lastHour !== SHORT_LOCK.threshold && !reachesLongLock) return;
    await this.journal.record({
      eventType: 'ACCOUNT_LOCKED',
      userId: input.userId,
      emailHmac: input.emailHmac,
      ...origin,
    });
    if (reachesLongLock && alertTo !== null) await this.alert(alertTo, now);
  }

  record(entry: JournalEntry): Promise<void> {
    return this.journal.record(entry);
  }

  /** L'échec d'envoi est déjà journalisé par le mailer ; il ne doit pas masquer la réponse 401. */
  private async alert(to: string, at: Date): Promise<void> {
    try {
      await this.mailer.sendLoginLocked(to, at);
    } catch (error: unknown) {
      if (!(error instanceof DomainError)) throw error;
    }
  }
}
