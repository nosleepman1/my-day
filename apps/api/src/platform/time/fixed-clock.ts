import type { ClockPort } from './clock.port';

/** Horloge de test : figée, avancée explicitement. Renvoie toujours une copie. */
export class FixedClock implements ClockPort {
  private current: number;

  constructor(start: Date) {
    this.current = start.getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(milliseconds: number): void {
    this.current += milliseconds;
  }

  set(instant: Date): void {
    this.current = instant.getTime();
  }
}
