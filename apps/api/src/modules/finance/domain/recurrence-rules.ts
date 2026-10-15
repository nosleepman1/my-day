import type { OccurrenceStatus } from '@orbit/contracts';

export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export type ParsedFinanceRecurrence = Readonly<{
  freq: RecurrenceFrequency;
  interval: number;
  byMonthDay?: number;
  byDay?: readonly string[];
  count?: number;
  until?: string; // YYYY-MM-DD
}>;

interface RuleDraft {
  readonly freq: RecurrenceFrequency | null;
  readonly interval: number;
  readonly byMonthDay?: number;
  readonly byDay?: readonly string[];
  readonly count?: number;
  readonly until?: string;
}

const DAY_MS = 86_400_000;

function parseUntil(raw: string): string | null {
  const match = /^([0-9]{4})([0-9]{2})([0-9]{2})$/.exec(raw);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseFreq(value: string): RecurrenceFrequency | null {
  if (value === 'WEEKLY' || value === 'MONTHLY' || value === 'QUARTERLY' || value === 'YEARLY') {
    return value;
  }
  return null;
}

function parseMonthDay(value: string): number | undefined {
  if (value === '-1') return -1;
  const parsed = Number.parseInt(value, 10);
  return !Number.isNaN(parsed) && parsed >= 1 && parsed <= 31 ? parsed : undefined;
}

function parseBoundedInt(value: string, min: number, max: number): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return !Number.isNaN(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

function parseRulePart(key: string, value: string): Partial<RuleDraft> {
  if (key === 'FREQ') {
    return { freq: parseFreq(value) };
  }
  if (key === 'INTERVAL') {
    return { interval: parseBoundedInt(value, 1, 99) ?? 1 };
  }
  if (key === 'BYMONTHDAY') {
    return { byMonthDay: parseMonthDay(value) };
  }
  if (key === 'BYDAY') {
    return { byDay: value.split(',') };
  }
  if (key === 'COUNT') {
    return { count: parseBoundedInt(value, 1, 999) };
  }
  if (key === 'UNTIL') {
    return { until: parseUntil(value) ?? undefined };
  }
  return {};
}

/**
 * Analyse une règle de récurrence financière sous forme RFC 5545 simplifiée.
 */
export function parseFinanceRecurrence(rule: string): ParsedFinanceRecurrence | null {
  const parts = rule.split(';');
  let draft: RuleDraft = {
    freq: null,
    interval: 1,
  };

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key && value) {
      draft = { ...draft, ...parseRulePart(key, value) };
    }
  }

  if (!draft.freq) return null;

  return {
    freq: draft.freq,
    interval: draft.interval,
    byMonthDay: draft.byMonthDay,
    byDay: draft.byDay,
    count: draft.count,
    until: draft.until,
  };
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function toCivil(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}

function fromCivil(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

/**
 * Calcule la date cible du mois offset en appliquant la règle de fin de mois.
 */
function getMonthOccurrenceDate(anchorDate: string, monthOffset: number, targetDay?: number): string {
  const base = new Date(fromCivil(anchorDate));
  const anchorDay = base.getUTCDate();
  const totalMonths = base.getUTCFullYear() * 12 + base.getUTCMonth() + monthOffset;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  const maxDays = daysInMonth(year, month);

  let day: number;
  if (targetDay === -1) {
    day = maxDays;
  } else if (targetDay !== undefined) {
    day = Math.min(targetDay, maxDays);
  } else {
    day = Math.min(anchorDay, maxDays);
  }

  return toCivil(Date.UTC(year, month, day));
}

interface OccurrencesGenerationContext {
  readonly anchorDate: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly until?: string;
  readonly limitCount: number;
}

function generateWeeklyOccurrences(ctx: OccurrencesGenerationContext, interval: number): string[] {
  const { anchorDate, fromDate, toDate, until, limitCount } = ctx;
  const results: string[] = [];
  const anchorEpoch = fromCivil(anchorDate);
  const stepMs = interval * 7 * DAY_MS;

  for (let i = 0; i < limitCount; i += 1) {
    const epoch = anchorEpoch + i * stepMs;
    const dateStr = toCivil(epoch);
    if (until && dateStr > until) break;
    if (dateStr > toDate) break;
    if (dateStr >= fromDate && dateStr <= toDate) {
      results.push(dateStr);
    }
  }
  return results;
}

function getStepMonths(freq: 'MONTHLY' | 'QUARTERLY' | 'YEARLY', interval: number): number {
  if (freq === 'YEARLY') return interval * 12;
  if (freq === 'QUARTERLY') return interval * 3;
  return interval;
}

function generateMonthlyOccurrences(
  ctx: OccurrencesGenerationContext,
  freq: 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
  interval: number,
  byMonthDay?: number,
): string[] {
  const { anchorDate, fromDate, toDate, until, limitCount } = ctx;
  const results: string[] = [];
  const stepMonths = getStepMonths(freq, interval);

  for (let i = 0; i < limitCount; i += 1) {
    const monthOffset = i * stepMonths;
    const dateStr = getMonthOccurrenceDate(anchorDate, monthOffset, byMonthDay);
    if (until && dateStr > until) break;
    if (dateStr > toDate) break;
    if (dateStr >= fromDate && dateStr <= toDate) {
      results.push(dateStr);
    }
  }
  return results;
}

export type GenerateOccurrencesParams = Readonly<{
  recurrenceRule: string;
  anchorDate: string; // YYYY-MM-DD
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  maxCount?: number;
}>;

/**
 * Matérialise les dates d'occurrences pour une règle donnée sur un horizon civil.
 * Idempotent et sans dérive : calculé toujours à partir de l'ancrage.
 */
export function generateOccurrences(params: GenerateOccurrencesParams): string[] {
  const { recurrenceRule, anchorDate, fromDate, toDate, maxCount = 500 } = params;
  const rule = parseFinanceRecurrence(recurrenceRule);
  if (!rule) return [];

  const limitCount = Math.min(rule.count ?? maxCount, maxCount);
  const ctx: OccurrencesGenerationContext = {
    anchorDate,
    fromDate,
    toDate,
    until: rule.until,
    limitCount,
  };

  if (rule.freq === 'WEEKLY') {
    return generateWeeklyOccurrences(ctx, rule.interval);
  }

  return generateMonthlyOccurrences(ctx, rule.freq, rule.interval, rule.byMonthDay);
}

/**
 * Dérive si une occurrence est en retard (ADR-020) :
 * EXPECTED et due_on < todayCivil.
 */
export function isOccurrenceOverdue(params: {
  dueOn: string;
  status: OccurrenceStatus;
  todayCivil: string;
}): boolean {
  const { dueOn, status, todayCivil } = params;
  if (status !== 'EXPECTED') {
    return false;
  }
  return dueOn < todayCivil;
}
