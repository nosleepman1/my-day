/** Jeton d'injection de l'horloge (ARCHITECTURE.md §3, `platform/time`). */
export const CLOCK = Symbol('CLOCK');

/**
 * Source du temps courant. Les services l'injectent au lieu d'appeler `new Date()` (DESIGN_PATTERNS.md §2),
 * ce qui permet de tester les expirations avec `FixedClock`.
 */
export interface ClockPort {
  now(): Date;
}
