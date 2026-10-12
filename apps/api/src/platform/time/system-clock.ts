import type { ClockPort } from './clock.port';

/** Horloge réelle, liée au port `CLOCK` en dehors des tests. */
export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}
