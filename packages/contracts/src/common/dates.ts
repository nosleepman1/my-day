import { z } from 'zod';

/** Instant ISO 8601 avec fuseau explicite (`Z` ou décalage), normalisé en UTC par le serveur (API.md §6.2). */
export const InstantSchema = z.iso.datetime({ offset: true });

/** Date civile `YYYY-MM-DD` (ADR-023). */
export const CivilDateSchema = z.iso.date();

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Fuseau IANA (`Africa/Dakar`). */
export const TimezoneSchema = z.string().min(1).max(64).refine(isIanaTimezone, 'Fuseau horaire inconnu.');
