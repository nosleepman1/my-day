import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

import type { AuditAction } from '@orbit/contracts';

import { PrismaService } from '../database/prisma.service';
import { ipPrefix } from '../http/ip-prefix';
import type { IdGeneratorPort } from '../ids/id-generator.port';
import { ID_GENERATOR } from '../ids/ids.module';
import { CLOCK, type ClockPort } from '../time/clock.port';

export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'DENIED';
export type AuditActorType = 'USER' | 'ADMIN' | 'SYSTEM';

export type AuditEntry = Readonly<{
  action: AuditAction;
  /** Propriétaire de la donnée concernée ; `null` pour un événement sans compte identifié. */
  userId: string | null;
  actorType?: AuditActorType;
  actorUserId?: string | null;
  entityType?: string;
  entityId?: string;
  outcome?: AuditOutcome;
  ip?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

/** Clés jamais conservées dans `metadata` (DATA_MODEL.md, `audit_logs`). */
const SENSITIVE_KEY = /pass|token|secret|hash|key|cookie|authorization/i;
const MAX_STRING_LENGTH = 200;
const MAX_KEYS = 20;

/** Métadonnées filtrées : scalaires uniquement, clés sensibles retirées, chaînes tronquées, 20 clés au plus. */
export function sanitizeAuditMetadata(
  metadata: Readonly<Record<string, unknown>>,
): Record<string, Prisma.JsonValue> {
  const entries = Object.entries(metadata)
    .filter(([key]) => !SENSITIVE_KEY.test(key))
    .flatMap(([key, value]): [string, Prisma.JsonValue][] => {
      if (typeof value === 'string') return [[key, value.slice(0, MAX_STRING_LENGTH)]];
      if (typeof value === 'number' || typeof value === 'boolean' || value === null) return [[key, value]];
      return [];
    })
    .slice(0, MAX_KEYS);
  return Object.fromEntries(entries);
}

/** Journal `audit_logs` en ajout seul (SECURITY.md §18), daté et relié au `requestId` du contexte. */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly cls: ClsService,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    const actorUserId = entry.actorUserId ?? entry.userId;
    await this.prisma.auditLog.create({
      data: {
        id: this.ids.next(),
        userId: entry.userId,
        actorType: entry.actorType ?? (actorUserId === null ? 'SYSTEM' : 'USER'),
        actorUserId,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        outcome: entry.outcome ?? 'SUCCESS',
        requestId: this.cls.isActive() ? this.cls.getId() : null,
        ip: ipPrefix(entry.ip ?? null),
        metadata: sanitizeAuditMetadata(entry.metadata ?? {}),
        occurredAt: this.clock.now(),
      },
    });
  }
}
