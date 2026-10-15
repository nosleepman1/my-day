import { Inject, Injectable } from '@nestjs/common';
import type { LoginEventType } from '@prisma/client';

import type { ClientContext } from '../../platform/http/client-context';
import { CLOCK, type ClockPort } from '../../platform/time/clock.port';

import { AccountMailer } from './account-mailer.service';
import { EMAIL_VERIFICATION_TTL_HOURS } from './email-verification.service';
import { type JournalEntry, LoginJournal } from './login-journal.service';

/** SECURITY.md §3.5 : lien de réinitialisation valable 30 minutes. */
export const PASSWORD_RESET_TTL_MINUTES = 30;

export type AccountRef = Readonly<{ id: string; email: string }>;

/**
 * Événements de sécurité d'un compte : journal `login_events`, e-mails au titulaire et horloge commune,
 * pour que réinitialisation, changement de mot de passe et ré-authentification partagent un même point.
 */
@Injectable()
export class SecurityNotices {
  constructor(
    private readonly mailer: AccountMailer,
    private readonly journal: LoginJournal,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  now(): Date {
    return this.clock.now();
  }

  record(entry: JournalEntry): Promise<void> {
    return this.journal.record(entry);
  }

  countSessionEvents(sessionId: string, eventType: LoginEventType): Promise<number> {
    return this.journal.countSessionEvents(sessionId, eventType);
  }

  sendEmailChangeVerification(to: string, token: string): Promise<void> {
    return this.mailer.sendEmailChangeVerification(to, token, EMAIL_VERIFICATION_TTL_HOURS);
  }

  sendEmailChangeNotice(to: string, at: Date, ipPrefix: string | null): Promise<void> {
    return this.mailer.sendEmailChangeNotice(to, at, ipPrefix);
  }

  sendEmailChangeConflict(to: string): Promise<void> {
    return this.mailer.sendEmailChangeConflict(to);
  }

  sendPasswordReset(to: string, token: string): Promise<void> {
    return this.mailer.sendPasswordReset(to, token, PASSWORD_RESET_TTL_MINUTES);
  }

  /** Journalise le changement puis prévient le titulaire (SECURITY.md §3.5, §3.6). */
  async passwordChanged(
    account: AccountRef,
    eventType: 'PASSWORD_CHANGED' | 'PASSWORD_RESET_COMPLETED',
    client: ClientContext,
    sessionId: string | null,
  ): Promise<void> {
    const at = this.clock.now();
    await this.journal.record({
      eventType,
      userId: account.id,
      sessionId,
      ip: client.ip,
      userAgentLabel: client.userAgent,
    });
    await this.mailer.sendPasswordChanged(account.email, at);
  }
}
