/**
 * Dates et fuseaux (FRONTEND.md §8). Le fuseau de référence est celui des préférences de l'utilisateur,
 * jamais celui de l'appareil. Uniquement `Intl` : aucune dépendance de date tant que les écrans ne
 * manipulent que des instants et des dates civiles affichés.
 */

/** Date civile `YYYY-MM-DD`, transmise telle quelle à l'API. */
export type CivilDate = string;

export type DateFormat = 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'MM/dd/yyyy';

type ZonedParts = Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>;

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** @throws {RangeError} si la chaîne n'est pas une date civile valide. */
export function parseCivilDate(value: string): Readonly<{ year: number; month: number; day: number }> {
  const match = CIVIL_DATE.exec(value);
  if (match === null) throw new RangeError(`Invalid civil date: ${value}`);
  const [, year = '', month = '', day = ''] = match;
  const parsed = { year: Number(year), month: Number(month), day: Number(day) };
  const check = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  if (check.getUTCMonth() !== parsed.month - 1 || check.getUTCDate() !== parsed.day) {
    throw new RangeError(`Invalid civil date: ${value}`);
  }
  return parsed;
}

function partsIn(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
  };
}

/** « Aujourd'hui » dans le fuseau de l'utilisateur (retards, valeurs par défaut des dates). */
export function todayInZone(timeZone: string, now: Date = new Date()): CivilDate {
  const { year, month, day } = partsIn(now, timeZone);
  return `${year}-${month}-${day}`;
}

/** Date civile affichée selon la préférence (`dd/MM/yyyy` par défaut, DESIGN_SYSTEM.md §8). */
export function formatCivilDate(value: CivilDate, format: DateFormat = 'dd/MM/yyyy'): string {
  const { year, month, day } = parseCivilDate(value);
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yyyy = String(year);
  switch (format) {
    case 'dd/MM/yyyy':
      return `${dd}/${mm}/${yyyy}`;
    case 'yyyy-MM-dd':
      return `${yyyy}-${mm}-${dd}`;
    case 'MM/dd/yyyy':
      return `${mm}/${dd}/${yyyy}`;
  }
}

/** Instant ISO 8601 de l'API affiché dans le fuseau de l'utilisateur, heures sur 24 h. */
export function formatInstant(iso: string, timeZone: string, format: DateFormat = 'dd/MM/yyyy'): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) throw new RangeError(`Invalid instant: ${iso}`);
  const { year, month, day, hour, minute } = partsIn(instant, timeZone);
  return `${formatCivilDate(`${year}-${month}-${day}`, format)} ${hour}:${minute}`;
}

/** Fuseaux proposés dans les préférences (liste IANA du moteur, `Africa/Dakar` garanti). */
export function availableTimeZones(): readonly string[] {
  const zones = Intl.supportedValuesOf('timeZone');
  return zones.includes('Africa/Dakar') ? zones : ['Africa/Dakar', ...zones];
}

/** Fuseau de l'appareil, pour le bandeau d'écart avec la préférence. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
