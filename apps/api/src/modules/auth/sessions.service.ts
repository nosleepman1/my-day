import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedSession, SessionResolverPort } from '../../platform/auth/session-resolver.port';
import { generateOpaqueToken, hashOpaqueToken } from '../../platform/auth/session-token';
import type { ClientContext } from '../../platform/http/client-context';
import { ipPrefix } from '../../platform/http/ip-prefix';
import { CLOCK, type ClockPort } from '../../platform/time/clock.port';

import { AUTH_SETTINGS, type AuthSettings } from './auth-settings';
import {
  type SessionRevokeReason,
  type SessionStore,
  SessionsRepository,
  type StoredSession,
} from './sessions.repository';

/** SECURITY.md §3.2 : 20 sessions actives, prolongation d'inactivité au plus une fois par minute. */
export const MAX_ACTIVE_SESSIONS = 20;
const TOUCH_INTERVAL_MS = 60_000;
const PURGE_AFTER_MS = 30 * 86_400_000;

export type OpenedSession = Readonly<{
  sessionId: string;
  /** Valeur du cookie ; jamais stockée ni journalisée. */
  token: string;
  openedAt: Date;
  absoluteExpiresAt: Date;
}>;

function isActive(session: StoredSession | null, now: Date): session is StoredSession {
  return (
    session !== null &&
    session.revokedAt === null &&
    session.userStatus === 'ACTIVE' &&
    session.idleExpiresAt.getTime() > now.getTime() &&
    session.absoluteExpiresAt.getTime() > now.getTime()
  );
}

/** Cycle de vie des sessions serveur (ADR-006) ; résolveur du guard global. */
@Injectable()
export class SessionsService implements SessionResolverPort {
  constructor(
    @Inject(SessionsRepository) private readonly store: SessionStore,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}

  /** Nouveau jeton à chaque ouverture ; celui présenté par le navigateur est révoqué, jamais réutilisé. */
  async open(userId: string, client: ClientContext, previousToken: string | null): Promise<OpenedSession> {
    const now = this.clock.now();
    const { token, hash } = generateOpaqueToken();
    const absoluteExpiresAt = new Date(now.getTime() + this.settings.sessionAbsoluteMs);
    const sessionId = await this.store.create({
      userId,
      tokenHash: hash,
      createdAt: now,
      idleExpiresAt: this.idleExpiry(now, absoluteExpiresAt),
      absoluteExpiresAt,
      ip: ipPrefix(client.ip),
      userAgentLabel: client.userAgent,
      replacedTokenHash: previousToken === null ? null : hashOpaqueToken(previousToken),
      maxActive: MAX_ACTIVE_SESSIONS,
      purgeBefore: new Date(now.getTime() - PURGE_AFTER_MS),
    });
    return { sessionId, token, openedAt: now, absoluteExpiresAt };
  }

  async resolve(token: string): Promise<AuthenticatedSession | null> {
    const session = await this.store.findByTokenHash(hashOpaqueToken(token));
    const now = this.clock.now();
    if (!isActive(session, now)) return null;
    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.store.touch(session.id, now, this.idleExpiry(now, session.absoluteExpiresAt));
    }
    return { sessionId: session.id, userId: session.userId, role: session.userRole };
  }

  revoke(sessionId: string, reason: SessionRevokeReason): Promise<void> {
    return this.store.revoke(sessionId, reason, this.clock.now());
  }

  /** Inactivité glissante, jamais au-delà de l'expiration absolue. */
  private idleExpiry(now: Date, absoluteExpiresAt: Date): Date {
    return new Date(Math.min(now.getTime() + this.settings.sessionIdleMs, absoluteExpiresAt.getTime()));
  }
}
