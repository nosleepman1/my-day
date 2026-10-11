import { Module } from '@nestjs/common';

import { ConfigModule } from './platform/config/config.module';
import { DatabaseModule } from './platform/database/database.module';
import { ObservabilityModule } from './platform/observability/observability.module';

/** Module racine du worker : vide jusqu'à PHASE-08, où il accueillera les processeurs de jobs (ADR-012). */
@Module({ imports: [ConfigModule, ObservabilityModule, DatabaseModule] })
export class WorkerModule {}
