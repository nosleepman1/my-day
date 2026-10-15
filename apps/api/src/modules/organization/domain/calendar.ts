/**
 * Calendrier de l'utilisateur (ADR-023) : dates civiles `YYYY-MM-DD` calculées dans son fuseau IANA.
 * Fonctions pures ; l'instant courant vient de l'horloge injectée par l'appelant.
 */

export type CalendarSnapshot = Readonly<{
  now: Date;
  timezone: string;
  today: string;
  weekStart: string;
  weekEnd: string;
}>;

const DAY_MS = 86_400_000;

/** Date civile d'un instant dans un fuseau (le format `en-CA` donne `AAAA-MM-JJ`). */
export function civilDateIn(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Lundi = 1 … dimanche = 7 (ISO 8601). */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Semaine contenant `today`, commençant le jour `weekStartsOn` (1 = lundi, préférence utilisateur). */
export function weekRange(today: string, weekStartsOn: number): Readonly<{ start: string; end: string }> {
  const offset = (isoWeekday(today) - weekStartsOn + 7) % 7;
  const start = addDays(today, -offset);
  return { start, end: addDays(start, 6) };
}

export function calendarSnapshot(now: Date, timezone: string, weekStartsOn: number): CalendarSnapshot {
  const today = civilDateIn(now, timezone);
  const week = weekRange(today, weekStartsOn);
  return { now, timezone, today, weekStart: week.start, weekEnd: week.end };
}

/** Date civile → `Date` à minuit UTC, forme attendue par Prisma pour une colonne `DATE`. */
export function civilToDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function dateToCivil(date: Date): string {
  return date.toISOString().slice(0, 10);
}
