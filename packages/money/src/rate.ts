import { scaleOf, type CurrencyCode } from './currency';
import { MoneyError } from './errors';
import { money, type Money } from './money';
import { roundHalfUp } from './rounding';

/** Précision des taux de change et des taux appliqués : NUMERIC(20,10) (ADR-008). */
export const RATE_SCALE = 10;
const RATE_DIVISOR = 10n ** BigInt(RATE_SCALE);
const DECIMAL_FORMAT = /^(\d+)(?:\.(\d+))?$/;

/**
 * Convertit une chaîne décimale positive (« 655.957 ») en entier mis à l'échelle `scale`.
 * @throws {MoneyError} `INVALID_DECIMAL` ou `TOO_MANY_DECIMALS`.
 */
export function toScaled(value: string, scale: number): bigint {
  const match = DECIMAL_FORMAT.exec(value);
  if (match === null) {
    throw new MoneyError('INVALID_DECIMAL', `Invalid decimal: ${JSON.stringify(value)}`);
  }
  const [, integerPart = '', fraction = ''] = match;
  if (fraction.length > scale) {
    throw new MoneyError('TOO_MANY_DECIMALS', `At most ${scale} decimals allowed`);
  }
  return BigInt(integerPart) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0').padStart(1, '0'));
}

/** Applique un taux décimal (« 0.18 ») avec un seul arrondi half-up. */
export function multiplyRate(value: Money, rate: string): Money {
  const scaledRate = toScaled(rate, RATE_SCALE);
  return money(roundHalfUp(value.minor * scaledRate, RATE_DIVISOR), value.currency);
}

/**
 * Convertit vers `target` au taux fourni par l'utilisateur, jamais inventé (FINANCE_RULES §2.2, §6).
 * `rate` = unités de `target` pour une unité de la devise source.
 * @throws {MoneyError} `INVALID_DECIMAL` si le taux n'est pas strictement positif.
 */
export function convert(value: Money, target: CurrencyCode, rate: string): Money {
  const scaledRate = toScaled(rate, RATE_SCALE);
  if (scaledRate === 0n) throw new MoneyError('INVALID_DECIMAL', 'Rate must be strictly positive');
  const numerator = value.minor * scaledRate * scaleOf(target);
  return money(roundHalfUp(numerator, RATE_DIVISOR * scaleOf(value.currency)), target);
}
