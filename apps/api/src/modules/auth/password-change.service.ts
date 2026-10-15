import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedSession } from '../../platform/auth/session-resolver.port';
import type { ClientContext } from '../../platform/http/client-context';

import { PasswordChanger } from './password-changer.service';
import { ReauthService } from './reauth.service';
import { type OpenedSession, SessionsService } from './sessions.service';

interface SessionOpener {
  open(userId: string, client: ClientContext, previousToken: string | null): Promise<OpenedSession>;
}

export type RotatedSession = Readonly<{ token: string; maxAgeSeconds: number }>;

/**
 * `POST /me/password` (SECURITY.md §3.6) : le mot de passe actuel vaut ré-authentification (mêmes journal
 * et révocation après 10 échecs) ; toutes les sessions sont révoquées, puis une nouvelle est ouverte pour
 * l'appareil courant (rotation du jeton).
 */
@Injectable()
export class PasswordChangeService {
  constructor(
    private readonly reauths: ReauthService,
    private readonly changer: PasswordChanger,
    @Inject(SessionsService) private readonly sessions: SessionOpener,
  ) {}

  /** @throws {DomainError} REAUTH_FAILED (mot de passe actuel faux) ou VALIDATION_FAILED. */
  async change(
    session: AuthenticatedSession,
    passwords: Readonly<{ currentPassword: string; newPassword: string }>,
    client: ClientContext,
  ): Promise<RotatedSession> {
    const credentials = await this.reauths.assertPassword(session, passwords.currentPassword, client);
    await this.changer.change(credentials, passwords.newPassword, {
      eventType: 'PASSWORD_CHANGED',
      keepSessionId: null,
      client,
      field: 'newPassword',
    });
    const opened = await this.sessions.open(credentials.id, client, null);
    return {
      token: opened.token,
      maxAgeSeconds: Math.floor((opened.absoluteExpiresAt.getTime() - opened.openedAt.getTime()) / 1_000),
    };
  }
}
