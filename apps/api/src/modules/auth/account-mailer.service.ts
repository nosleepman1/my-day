import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainError } from '../../platform/errors/domain-error';
import { defaultMessageOf } from '../../platform/http/error-mapping';
import { MailDeliveryError } from '../../platform/mail/mail-delivery.error';
import { buildTokenLink } from '../../platform/mail/mail-links';
import { MAIL, type MailPort, type MailRequest } from '../../platform/mail/mail.port';

import { AUTH_SETTINGS, type AuthSettings } from './auth-settings';

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

  /** L'adresse n'est jamais journalisée ; le client reçoit un 503 générique. */
  private async deliver(request: MailRequest): Promise<void> {
    try {
      await this.mail.send(request);
    } catch (error: unknown) {
      if (!(error instanceof MailDeliveryError)) throw error;
      this.logger.error({ err: error, template: request.template }, 'auth.mail_delivery_failed');
      throw new DomainError('SERVICE_UNAVAILABLE', defaultMessageOf('SERVICE_UNAVAILABLE'));
    }
  }
}
