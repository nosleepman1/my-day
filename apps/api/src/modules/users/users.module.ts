import { Module } from '@nestjs/common';

import { AdminProvisioningService } from './admin-provisioning.service';
import { MeController } from './me.controller';
import { PreferencesRepository } from './preferences.repository';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/** M01 : comptes, profil et préférences (`users`, `user_preferences`) ; routes `/me`. */
@Module({
  controllers: [MeController],
  providers: [UsersRepository, PreferencesRepository, UsersService, AdminProvisioningService],
  exports: [UsersService, AdminProvisioningService],
})
export class UsersModule {}
