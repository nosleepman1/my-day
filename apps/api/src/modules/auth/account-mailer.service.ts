import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { buildTokenLink } from '../../platform/mail/mail-links';
import { MAIL, type MailPort, type MailRequest } from '../../platform/mail/mail.port';

import { AUTH_SETTINGS, type AuthSettings } from './auth-settings';

/** Fuseau des e-mails d'alerte tant que les préférences ne sont pas lues ici (T10). */
const DEFAULT_TIME_ZONE = 'Africa/Dakar';

/** E-mails de compte du module auth : construit les liens vers le front et traduit les échecs d'envoi. */
@Injectable()
export class AccountMailer {
  constructor(
    @Inject(MAIL) private readonly mail: MailPort,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
    @InjectPinoLogger(AccountMailer.name) private readonly logger: PinoLogger,
  ) {}

  sendVerification(to: string, token: string, expiresInHours: number): Promise<void> {
    return this.deliver({
      to,
      template: 'email-verification',
      data: {
        verifyUrl: buildTokenLink(this.settings.appOrigin, '/verify-email', token),
        expiresInHours,
      },
    });
  }

  sendRegistrationAttempt(to: string): Promise<void> {
    const { appOrigin } = this.settings;
    return this.deliver({
      to,
      template: 'registration-attempt',
      data: { loginUrl: `${appOrigin}/login`, resetUrl: `${appOrigin}/forgot-password` },
    });
  }

  sendPasswordReset(to: string, token: string, expiresInMinutes: number): Promise<void> {
    return this.deliver({
      to,
      template: 'password-reset',
      data: {
        resetUrl: buildTokenLink(this.settings.appOrigin, '/reset-password', token),
        expiresInMinutes,
      },
    });
  }

  /** Lien de confirmation envoyé à la nouvelle adresse (SECURITY.md §3.6). */
  sendEmailChangeVerification(to: string, token: string, expiresInHours: number): Promise<void> {
    return this.deliver({
      to,
      template: 'email-change-verification',
      data: {
        confirmUrl: buildTokenLink(this.settings.appOrigin, '/confirm-email-change', token),
        expiresInHours,
      },
    });
  }

  /** Avertissement à l'ancienne adresse, avec la date et l'IP tronquée. */
  sendEmailChangeNotice(to: string, occurredAt: Date, ipPrefix: string | null): Promise<void> {
    return this.deliver({
      to,
      template: 'email-change-notice',
      data: { occurredAt, timeZone: DEFAULT_TIME_ZONE, ipPrefix },
    });
  }

  /** Adresse déjà utilisée par un autre compte : son titulaire est prévenu, rien ne change. */
  sendEmailChangeConflict(to: string): Promise<void> {
    return this.deliver({
      to,
      template: 'email-change-conflict',
      data: { resetUrl: `${this.settings.appOrigin}/forgot-password` },
    });
  }

  sendPasswordChanged(to: string, occurredAt: Date): Promise<void> {
    return this.deliver({
      to,
      template: 'password-changed',
      data: { occurredAt, timeZone: DEFAULT_TIME_ZONE },
    });
  }

  /** Alerte de verrouillage de 24 h (SECURITY.md §3.7), envoyée au titulaire du compte. */
  sendLoginLocked(to: string, occurredAt: Date): Promise<void> {
    const { appOrigin } = this.settings;
    return this.deliver({
      to,
      template: 'login-locked',
      data: { occurredAt, timeZone: DEFAULT_TIME_ZONE, resetUrl: `${appOrigin}/forgot-password` },
    });
  }

  /**
   * Envoi détaché de la réponse : sa durée et ses échecs ne révèlent pas l'existence d'un compte (revue
   * sécurité PHASE-01, M2). L'échec est journalisé sans l'adresse ; la file de PHASE-08 réessaiera.
   */
  private deliver(request: MailRequest): Promise<void> {
    void this.mail.send(request).catch((error: unknown) => {
      this.logger.error({ err: error, template: request.template }, 'auth.mail_delivery_failed');
    });
    return Promise.resolve();
  }
}
