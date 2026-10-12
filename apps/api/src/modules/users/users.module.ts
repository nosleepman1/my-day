import { Module } from '@nestjs/common';

import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/** M01 : comptes et préférences (`users`, `user_preferences`). Les routes `/me` arrivent en T10. */
@Module({
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
