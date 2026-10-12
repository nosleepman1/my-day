import { Module } from '@nestjs/common';

import { APP_CONFIG } from '../../platform/config/config.module';
import { UsersModule } from '../users';

import { AccountMailer } from './account-mailer.service';
import { AUTH_SETTINGS, authSettingsFrom } from './auth-settings';
import { EmailConfirmationService } from './email-confirmation.service';
import { EmailVerificationTokensRepository } from './email-verification-tokens.repository';
import { EmailVerificationController } from './email-verification.controller';
import { EmailVerificationService } from './email-verification.service';
import { LoginEventsRepository } from './login-events.repository';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';

/** M01 : inscription, vérification d'e-mail, sessions, réinitialisation (routes `/auth/*`). */
@Module({
  imports: [UsersModule],
  controllers: [RegistrationController, EmailVerificationController],
  providers: [
    { provide: AUTH_SETTINGS, inject: [APP_CONFIG], useFactory: authSettingsFrom },
    AccountMailer,
    EmailVerificationTokensRepository,
    EmailVerificationService,
    EmailConfirmationService,
    LoginEventsRepository,
    RegistrationService,
  ],
})
export class AuthModule {}
