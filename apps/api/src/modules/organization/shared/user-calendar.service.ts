import { Injectable } from '@nestjs/common';

import { type CalendarSnapshot, calendarSnapshot } from '../domain/calendar';

import { OrganizationContext } from './organization-context';

/** Fuseau retenu si les préférences manquent (valeur par défaut de `user_preferences`). */
const DEFAULT_TIMEZONE = 'Africa/Dakar';
const DEFAULT_WEEK_START = 1;

/** Jour courant et semaine de l'utilisateur, d'après ses préférences (ADR-023). */
@Injectable()
export class UserCalendarService {
  constructor(private readonly ctx: OrganizationContext) {}

  async snapshot(): Promise<CalendarSnapshot> {
    const preferences = await this.ctx.db.userPreference.findFirst({
      select: { timezone: true, weekStartsOn: true },
    });
    return calendarSnapshot(
      this.ctx.now(),
      preferences?.timezone ?? DEFAULT_TIMEZONE,
      preferences?.weekStartsOn ?? DEFAULT_WEEK_START,
    );
  }

  now(): Date {
    return this.ctx.now();
  }
}
