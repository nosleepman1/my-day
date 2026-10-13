import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { SessionAuthGuard } from '../../platform/auth/session-auth.guard';
import { SESSION_RESOLVER } from '../../platform/auth/session-resolver.port';
import { APP_CONFIG } from '../../platform/config/config.module';
import { UsersModule } from '../users';

import { AccountMailer } from './account-mailer.service';
import { AUTH_SETTINGS, authSettingsFrom } from './auth-settings';
import { EmailConfirmationService } from './email-confirmation.service';
import { EmailVerificationTokensRepository } from './email-verification-tokens.repository';
import { EmailVerificationController } from './email-verification.controller';
import { EmailVerificationService } from './email-verification.service';
import { LoginEventsRepository } from './login-events.repository';
import { LoginJournal } from './login-journal.service';
import { LoginService } from './login.service';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';
import { SessionController } from './session.controller';
import { SessionsRepository } from './sessions.repository';
import { SessionsService } from './sessions.service';

/** M01 : inscription, vérification d'e-mail, sessions, réinitialisation (routes `/auth/*`). */
@Module({
  imports: [UsersModule],
  controllers: [RegistrationController, EmailVerificationController, SessionController],
  providers: [
    { provide: AUTH_SETTINGS, inject: [APP_CONFIG], useFactory: authSettingsFrom },
    AccountMailer,
    EmailVerificationTokensRepository,
    EmailVerificationService,
    EmailConfirmationService,
    LoginEventsRepository,
    RegistrationService,
    SessionsRepository,
    SessionsService,
    LoginJournal,
    LoginService,
    { provide: SESSION_RESOLVER, useExisting: SessionsService },
    // Guard global : toute route exige une session, sauf `@Public()` (SECURITY.md §3.1).
    { provide: APP_GUARD, useClass: SessionAuthGuard },
  ],
})
export class AuthModule {}
