import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { DomainError } from '../errors/domain-error';
import type { IdGeneratorPort } from '../ids/id-generator.port';
import { ID_GENERATOR } from '../ids/ids.module';
import { CLOCK, type ClockPort } from '../time/clock.port';

const KEY_REGEX = /^[A-Za-z0-9_-]{16,128}$/;
const DEFAULT_EXPIRATION_DAYS = 7;

export type StartIdempotencyResult =
  | { readonly status: 'STARTED' }
  | {
      readonly status: 'REPLAYED';
      readonly responseStatus: number;
      readonly responseBody: unknown;
    };

export interface StartIdempotencyParams {
  readonly userId: string;
  readonly scope: string;
  readonly key: string;
  readonly requestHash: Buffer;
  readonly ttlSeconds?: number;
}

export interface CompleteIdempotencyParams {
  readonly userId: string;
  readonly scope: string;
  readonly key: string;
  readonly responseStatus: number;
  readonly responseBody?: unknown;
  readonly resourceId?: string | null;
}

@Injectable()
export class IdempotencyService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  validateKey(key: string): void {
    if (!KEY_REGEX.test(key)) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'La clé d’idempotence doit comporter entre 16 et 128 caractères [A-Za-z0-9_-].',
        { field: 'Idempotency-Key' },
      );
    }
  }

  private async checkExisting(
    params: StartIdempotencyParams,
    now: Date,
  ): Promise<StartIdempotencyResult | null> {
    const existing = await this.prisma.idempotencyKey.findFirst({
      where: { userId: params.userId, scope: params.scope, key: params.key },
    });

    if (!existing) return null;

    if (existing.expiresAt.getTime() <= now.getTime()) {
      await this.prisma.idempotencyKey.delete({
        where: { userId_scope_key: { userId: params.userId, scope: params.scope, key: params.key } },
      });
      return null;
    }

    if (existing.status === 'IN_PROGRESS') {
      throw new DomainError(
        'IDEMPOTENCY_IN_PROGRESS',
        'Une opération avec cette clé d’idempotence est déjà en cours.',
        { retryAfter: 1 },
      );
    }

    const storedHash = Buffer.from(existing.requestHash);
    if (Buffer.compare(storedHash, params.requestHash) !== 0) {
      throw new DomainError(
        'IDEMPOTENCY_REPLAY',
        'Clé d’idempotence déjà utilisée avec un corps de requête différent.',
      );
    }

    return {
      status: 'REPLAYED',
      responseStatus: existing.responseStatus ?? 200,
      responseBody: existing.responseBody,
    };
  }

  async start(params: StartIdempotencyParams): Promise<StartIdempotencyResult> {
    this.validateKey(params.key);
    const now = this.clock.now();
    const existingResult = await this.checkExisting(params, now);
    if (existingResult) return existingResult;

    const ttl = params.ttlSeconds ?? DEFAULT_EXPIRATION_DAYS * 86400;
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    await this.prisma.idempotencyKey.create({
      data: {
        id: this.ids.next(),
        userId: params.userId,
        scope: params.scope,
        key: params.key,
        requestHash: new Uint8Array(params.requestHash),
        status: 'IN_PROGRESS',
        expiresAt,
      },
    });

    return { status: 'STARTED' };
  }

  async complete(params: CompleteIdempotencyParams): Promise<void> {
    const isCacheable =
      (params.responseStatus >= 200 && params.responseStatus < 300) ||
      params.responseStatus === 409 ||
      params.responseStatus === 422;

    if (!isCacheable) {
      await this.abort(params.userId, params.scope, params.key);
      return;
    }

    await this.prisma.idempotencyKey.update({
      where: { userId_scope_key: { userId: params.userId, scope: params.scope, key: params.key } },
      data: {
        status: 'COMPLETED',
        responseStatus: params.responseStatus,
        responseBody: (params.responseBody ?? null) as Prisma.InputJsonValue,
        resourceId: params.resourceId ?? null,
        completedAt: this.clock.now(),
      },
    });
  }

  async abort(userId: string, scope: string, key: string): Promise<void> {
    await this.prisma.idempotencyKey
      .delete({
        where: { userId_scope_key: { userId, scope, key } },
      })
      .catch(() => undefined);
  }
}
