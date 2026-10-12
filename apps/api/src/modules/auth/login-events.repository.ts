import { Inject, Injectable } from '@nestjs/common';
import type { LoginEventType } from '@prisma/client';

import { PrismaService } from '../../platform/database/prisma.service';
import type { IdGeneratorPort } from '../../platform/ids/id-generator.port';
import { ID_GENERATOR } from '../../platform/ids/ids.module';

export type LoginEventInput = Readonly<{
  eventType: LoginEventType;
  /** NULL pour une tentative sur une adresse inconnue (DATA_MODEL.md, `login_events`). */
  userId?: string | null;
  /** HMAC-SHA256 de l'adresse saisie, jamais l'adresse en clair (T6). */
  emailHmac?: Buffer | null;
  /** Code stable : `INVALID_CREDENTIALS`, `LOCKED`… */
  failureCode?: string | null;
  sessionId?: string | null;
  ip: string | null;
  userAgentLabel: string | null;
  occurredAt: Date;
}>;

export interface LoginEventRecorder {
  record(event: LoginEventInput): Promise<void>;
}

/**
 * Journal append-only des événements d'authentification. `orbit_app` n'a que `SELECT, INSERT` sur la table
 * et un déclencheur refuse toute modification : ce repository n'expose donc qu'un ajout.
 */
@Injectable()
export class LoginEventsRepository implements LoginEventRecorder {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  async record(event: LoginEventInput): Promise<void> {
    await this.prisma.loginEvent.create({
      data: {
        id: this.ids.next(),
        eventType: event.eventType,
        userId: event.userId ?? null,
        emailHmac: event.emailHmac ? new Uint8Array(event.emailHmac) : null,
        failureCode: event.failureCode ?? null,
        sessionId: event.sessionId ?? null,
        ip: event.ip,
        userAgentLabel: event.userAgentLabel,
        occurredAt: event.occurredAt,
      },
    });
  }
}
