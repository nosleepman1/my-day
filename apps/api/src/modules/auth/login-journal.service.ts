import { Inject, Injectable } from '@nestjs/common';

import { CLOCK, type ClockPort } from '../../platform/time/clock.port';

import {
  type LoginEventInput,
  type LoginEventRecorder,
  LoginEventsRepository,
} from './login-events.repository';

export type JournalEntry = Omit<LoginEventInput, 'occurredAt'>;

/** Ajoute un événement à `login_events`, horodaté par l'horloge injectée. */
@Injectable()
export class LoginJournal {
  constructor(
    @Inject(LoginEventsRepository) private readonly events: LoginEventRecorder,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  record(entry: JournalEntry): Promise<void> {
    return this.events.record({ ...entry, occurredAt: this.clock.now() });
  }
}
