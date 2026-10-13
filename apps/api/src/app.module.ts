import { Module } from '@nestjs/common';

import { AuthModule } from './modules/auth';
import { UsersModule } from './modules/users';
import { PlatformModule } from './platform/platform.module';

/** Module racine HTTP : le socle, puis les modules métier ajoutés phase par phase (ARCHITECTURE.md §4). */
@Module({ imports: [PlatformModule, UsersModule, AuthModule] })
export class AppModule {}
