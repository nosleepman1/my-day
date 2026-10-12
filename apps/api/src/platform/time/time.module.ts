import { Global, Module } from '@nestjs/common';

import { CLOCK } from './clock.port';
import { SystemClock } from './system-clock';

/** Horloge de l'application ; les tests la remplacent par `FixedClock`. */
@Global()
@Module({
  providers: [{ provide: CLOCK, useClass: SystemClock }],
  exports: [CLOCK],
})
export class TimeModule {}
