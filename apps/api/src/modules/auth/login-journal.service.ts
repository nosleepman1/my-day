import { Inject, Injectable } from '@nestjs/common';
import type { LoginEventType } from '@prisma/client';

import { CLOCK, type ClockPort } from '../../platform/time/clock.port';

import {
  type LoginEventInput,
  type FailureStats,
  type LoginEventStore,
  LoginEventsRepository,
} from './login-events.repository';

export type JournalEntry = Omit<LoginEventInput, 'occurredAt'>;

/** Ajoute un événement à `login_events`, horodaté par l'horloge injectée. */
@Injectable()
export class LoginJournal {
  constructor(
    @Inject(LoginEventsRepository) private readonly events: LoginEventStore,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  record(entry: JournalEntry): Promise<void> {
    return this.events.record({ ...entry, occurredAt: this.clock.now() });
  }

  failureStats(emailHmac: Buffer, now: Date): Promise<FailureStats> {
    return this.events.failureStats(emailHmac, now);
  }

  countSessionEvents(sessionId: string, eventType: LoginEventType): Promise<number> {
    return this.events.countSessionEvents(sessionId, eventType);
  }
}
