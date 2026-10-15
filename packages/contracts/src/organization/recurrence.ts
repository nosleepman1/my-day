/**
 * Récurrence de tâche : sous-ensemble de RRULE (RFC 5545) retenu en PHASE-04.
 *   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY (en tête), INTERVAL=1..99,
 *   BYDAY=MO,TU,… (WEEKLY seulement), BYMONTHDAY=1..31 (MONTHLY seulement),
 *   COUNT=1..999 ou UNTIL=AAAAMMJJ (exclusifs).
 * Fin de mois : un jour absent du mois (31, 30, 29 février) est ramené au dernier jour du mois, au lieu
 * d'être sauté comme le prévoit la RFC ; « tous les 31 » signifie donc « chaque fin de mois ».
 * Fonctions pures sur des dates civiles `YYYY-MM-DD` (ADR-023), partagées par l'API et le front.
 */

export const RECURRENCE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type Recurrence = Readonly<{
  freq: RecurrenceFrequency;
  interval: number;
  byDay?: readonly Weekday[];
  byMonthDay?: number;
  count?: number;
  /** Date civile incluse. */
  until?: string;
}>;

const MAX_RULE_LENGTH = 200;
const DAY_MS = 86_400_000;

function intIn(raw: string, min: number, max: number): number | null {
  if (!/^[0-9]{1,3}$/.test(raw)) return null;
  const value = Number.parseInt(raw, 10);
  return value >= min && value <= max ? value : null;
}

function fromCivil(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

function toCivil(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}

function untilOf(raw: string): string | null {
  const match = /^([0-9]{4})([0-9]{2})([0-9]{2})$/.exec(raw);
  if (match === null) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const epoch = fromCivil(iso);
  return !Number.isNaN(epoch) && toCivil(epoch) === iso ? iso : null;
}

function byDayOf(raw: string): Weekday[] | null {
  const days = raw.split(',');
  const valid = days.every((day): day is Weekday => (WEEKDAYS as readonly string[]).includes(day));
  return valid && new Set(days).size === days.length ? days : null;
}

type RecurrencePart = Partial<Omit<Recurrence, 'freq'>>;
type PartParser = (value: string, freq: RecurrenceFrequency) => RecurrencePart | null;

const PART_PARSERS: Readonly<Record<string, PartParser>> = {
  INTERVAL: (value) => {
    const interval = intIn(value, 1, 99);
    return interval === null ? null : { interval };
  },
  BYDAY: (value, freq) => {
    const byDay = freq === 'WEEKLY' ? byDayOf(value) : null;
    return byDay === null ? null : { byDay };
  },
  BYMONTHDAY: (value, freq) => {
    const byMonthDay = freq === 'MONTHLY' ? intIn(value, 1, 31) : null;
    return byMonthDay === null ? null : { byMonthDay };
  },
  COUNT: (value) => {
    const count = intIn(value, 1, 999);
    return count === null ? null : { count };
  },
  UNTIL: (value) => {
    const until = untilOf(value);
    return until === null ? null : { until };
  },
};

function isFrequency(value: string | undefined): value is RecurrenceFrequency {
  return (RECURRENCE_FREQUENCIES as readonly (string | undefined)[]).includes(value);
}

/** Une partie `CLÉ=valeur` : `null` si la clé est inconnue, répétée, ou si la valeur est invalide. */
function parsePart(
  part: string,
  freq: RecurrenceFrequency,
  seen: ReadonlySet<string>,
): [string, RecurrencePart] | null {
  const [key = '', value = '', ...rest] = part.split('=');
  const parser = PART_PARSERS[key];
  if (rest.length > 0 || seen.has(key) || parser === undefined) return null;
  const parsed = parser(value, freq);
  return parsed === null ? null : [key, parsed];
}

/** Analyse une règle ; `null` si elle sort du sous-ensemble pris en charge. */
export function parseRecurrence(rule: string): Recurrence | null {
  if (rule.length > MAX_RULE_LENGTH) return null;
  const [head = '', ...parts] = rule.split(';');
  const freq = /^FREQ=([A-Z]+)$/.exec(head)?.[1];
  if (!isFrequency(freq)) return null;
  let parsed: Recurrence = { freq, interval: 1 };
  const seen = new Set<string>();
  for (const part of parts) {
    const piece = parsePart(part, freq, seen);
    if (piece === null) return null;
    seen.add(piece[0]);
    parsed = { ...parsed, ...piece[1] };
  }
  return parsed.count !== undefined && parsed.until !== undefined ? null : parsed;
}

/** Forme canonique d'une règle (ordre fixe des parties). */
export function formatRecurrence(rule: Recurrence): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval !== 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.byDay !== undefined) parts.push(`BYDAY=${rule.byDay.join(',')}`);
  if (rule.byMonthDay !== undefined) parts.push(`BYMONTHDAY=${rule.byMonthDay}`);
  if (rule.count !== undefined) parts.push(`COUNT=${rule.count}`);
  if (rule.until !== undefined) parts.push(`UNTIL=${rule.until.replaceAll('-', '')}`);
  return parts.join(';');
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Date du mois `monthOffset` après celui de `anchor`, jour ramené au dernier jour si nécessaire. */
function monthDate(anchor: string, monthOffset: number, day: number): string {
  const base = new Date(fromCivil(anchor));
  const total = base.getUTCFullYear() * 12 + base.getUTCMonth() + monthOffset;
  const year = Math.floor(total / 12);
  const month = total % 12;
  return toCivil(Date.UTC(year, month, Math.min(day, daysInMonth(year, month))));
}

/** Lundi = 0 … dimanche = 6. */
function weekdayIndex(epoch: number): number {
  return (new Date(epoch).getUTCDay() + 6) % 7;
}

const MAX_ITERATIONS = 2_000;

function nextDaily(rule: Recurrence, anchor: number, after: number): number {
  if (after < anchor) return anchor;
  const steps = Math.floor((after - anchor) / DAY_MS / rule.interval) + 1;
  return anchor + steps * rule.interval * DAY_MS;
}

function nextWeekly(rule: Recurrence, anchor: number, after: number): number | null {
  const fallback: readonly Weekday[] = [WEEKDAYS[weekdayIndex(anchor)] ?? 'MO'];
  const days = new Set((rule.byDay ?? fallback).map((day) => WEEKDAYS.indexOf(day)));
  const anchorMonday = anchor - weekdayIndex(anchor) * DAY_MS;
  let cursor = Math.max(anchor, after + DAY_MS);
  for (let i = 0; i < MAX_ITERATIONS; i += 1, cursor += DAY_MS) {
    const week = Math.floor((cursor - anchorMonday) / (7 * DAY_MS));
    if (week % rule.interval === 0 && days.has(weekdayIndex(cursor))) return cursor;
  }
  return null;
}

function nextByMonths(anchor: string, monthsPerStep: number, day: number, after: number): number | null {
  const anchorEpoch = fromCivil(anchor);
  for (let step = 0; step < MAX_ITERATIONS; step += 1) {
    const candidate = fromCivil(monthDate(anchor, step * monthsPerStep, day));
    if (candidate > after && candidate >= anchorEpoch) return candidate;
  }
  return null;
}

/**
 * Première occurrence strictement postérieure à `after` (et au moins égale à `anchor`).
 * `generated` = nombre d'occurrences déjà créées dans la série (l'occurrence d'ancrage comprise) :
 * avec `COUNT`, la série s'arrête quand ce nombre est atteint. `null` si la série est terminée.
 */
export function nextOccurrence(
  rule: Recurrence,
  anchor: string,
  after: string,
  generated: number,
): string | null {
  if (rule.count !== undefined && generated >= rule.count) return null;
  const anchorEpoch = fromCivil(anchor);
  const afterEpoch = fromCivil(after);
  const anchorDay = new Date(anchorEpoch).getUTCDate();
  let next: number | null;
  switch (rule.freq) {
    case 'DAILY':
      next = nextDaily(rule, anchorEpoch, afterEpoch);
      break;
    case 'WEEKLY':
      next = nextWeekly(rule, anchorEpoch, afterEpoch);
      break;
    case 'MONTHLY':
      next = nextByMonths(anchor, rule.interval, rule.byMonthDay ?? anchorDay, afterEpoch);
      break;
    case 'YEARLY':
      next = nextByMonths(anchor, 12 * rule.interval, anchorDay, afterEpoch);
      break;
  }
  if (next === null) return null;
  const date = toCivil(next);
  return rule.until !== undefined && date > rule.until ? null : date;
}
