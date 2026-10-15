import { Global, Module } from '@nestjs/common';

import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env.schema';

import { MAIL, type MailPort } from './mail.port';
import { AllowlistMailAdapter, createSmtpTransport, SmtpMailAdapter } from './smtp-mail.adapter';

/** Adaptateur SMTP de l'environnement, enveloppé par la liste blanche en staging (INFRASTRUCTURE.md §2). */
export function createMailPort(env: Env): MailPort {
  const transport = createSmtpTransport(env.SMTP_HOST, env.SMTP_PORT, {
    security: env.SMTP_SECURITY,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
  });
  const adapter = new SmtpMailAdapter(transport, env.MAIL_FROM);
  return env.APP_ENV === 'staging' ? new AllowlistMailAdapter(adapter, env.MAIL_ALLOWLIST) : adapter;
}

/** Liaison du port `MAIL` selon `MAIL_DRIVER` ; les tests la remplacent par `CapturingMailAdapter`. */
@Global()
@Module({
  providers: [{ provide: MAIL, inject: [APP_CONFIG], useFactory: createMailPort }],
  exports: [MAIL],
})
export class MailModule {}
