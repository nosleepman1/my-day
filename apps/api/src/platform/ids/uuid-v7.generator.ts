import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type { IdGeneratorPort } from './id-generator.port';

/** UUIDv7 ordonnés dans le temps : meilleure localité des index B-tree (ADR-011). */
@Injectable()
export class UuidV7Generator implements IdGeneratorPort {
  next(): string {
    return uuidv7();
  }
}
