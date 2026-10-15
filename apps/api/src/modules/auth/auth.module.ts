import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { Pseudonymizer } from '../../platform/auth/pseudonymizer';
import { RecentAuthGuard } from '../../platform/auth/require-reauth';
import { RolesGuard } from '../../platform/auth/roles';
import { SessionAuthGuard } from '../../platform/auth/session-auth.guard';
import { SESSION_RESOLVER } from '../../platform/auth/session-resolver.port';
import { APP_CONFIG } from '../../platform/config/config.module';
import type { Env } from '../../platform/config/env.schema';
import { CSRF_APP_ORIGIN, CsrfGuard } from '../../platform/http/csrf.guard';
import { OrbitThrottlerGuard, rateLimitOptions } from '../../platform/http/rate-limit';
import { UsersModule } from '../users';

import { AccountMailer } from './account-mailer.service';
import { AccountSecurityController } from './account-security.controller';
import { AUTH_SETTINGS, authSettingsFrom } from './auth-settings';
import { EmailChangeService } from './email-change.service';
import { EmailConfirmationService } from './email-confirmation.service';
import { EmailVerificationTokensRepository } from './email-verification-tokens.repository';
import { EmailVerificationController } from './email-verification.controller';
import { EmailVerificationService } from './email-verification.service';
import { LOGIN_ATTEMPTS_POLICY, LoginAttempts, loginAttemptsPolicyFrom } from './login-attempts.service';
import { LoginEventsRepository } from './login-events.repository';
import { LoginHistoryRepository } from './login-history.repository';
import { LoginHistoryService } from './login-history.service';
import { LoginJournal } from './login-journal.service';
import { LoginService } from './login.service';
import { MeSessionsController } from './me-sessions.controller';
import { PasswordChangeService } from './password-change.service';
import { PasswordChanger } from './password-changer.service';
import { PasswordResetRequestService } from './password-reset-request.service';
import { PasswordResetTokensRepository } from './password-reset-tokens.repository';
import { PasswordResetService } from './password-reset.service';
import { PasswordController } from './password.controller';
import { ReauthService } from './reauth.service';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';
import { SecurityNotices } from './security-notices.service';
import { SessionController } from './session.controller';
import { SessionsRepository } from './sessions.repository';
import { SessionsService } from './sessions.service';

/** M01 : inscription, vérification d'e-mail, sessions, réinitialisation (routes `/auth/*`). */
@Module({
  imports: [
    UsersModule,
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (env: Env) =>
        rateLimitOptions(env.RATE_LIMIT_ENABLED, new Pseudonymizer(env.RATE_LIMIT_HMAC_KEY)),
    }),
  ],
  controllers: [
    RegistrationController,
    EmailVerificationController,
    SessionController,
    PasswordController,
    AccountSecurityController,
    MeSessionsController,
  ],
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
    { provide: LOGIN_ATTEMPTS_POLICY, inject: [APP_CONFIG], useFactory: loginAttemptsPolicyFrom },
    LoginAttempts,
    PasswordResetTokensRepository,
    SecurityNotices,
    PasswordChanger,
    PasswordResetRequestService,
    PasswordResetService,
    ReauthService,
    EmailChangeService,
    PasswordChangeService,
    LoginHistoryRepository,
    LoginHistoryService,
    { provide: CSRF_APP_ORIGIN, inject: [APP_CONFIG], useFactory: (env: Env) => env.APP_ORIGIN },
    // Guard global : toute route exige une session, sauf `@Public()` (SECURITY.md §3.1).
    // Ordre voulu : CSRF, puis session, puis limitation de débit (qui distingue les utilisateurs connectés).
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: RecentAuthGuard },
    { provide: APP_GUARD, useClass: OrbitThrottlerGuard },
  ],
})
export class AuthModule {}
