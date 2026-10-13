import { Global, Module } from '@nestjs/common';

import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env.schema';

import { MAIL, type MailPort } from './mail.port';
import { createSmtpTransport, SmtpMailAdapter } from './smtp-mail.adapter';

/** Liaison du port `MAIL` selon `MAIL_DRIVER` ; les tests la remplacent par `CapturingMailAdapter`. */
@Global()
@Module({
  providers: [
    {
      provide: MAIL,
      inject: [APP_CONFIG],
      useFactory: (env: Env): MailPort =>
        new SmtpMailAdapter(createSmtpTransport(env.SMTP_HOST, env.SMTP_PORT), env.MAIL_FROM),
    },
  ],
  exports: [MAIL],
})
export class MailModule {}
