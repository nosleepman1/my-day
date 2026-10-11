import { CURRENCIES, exponentOf, scaleOf } from './currency';
import type { Money } from './money';

const NBSP = '\u00A0';
const MASK = '•••••';

export type FormatOptions = Readonly<{
  /** Locale BCP 47, `fr-FR` par défaut. */
  locale?: string;
  /** Mode « masquer les soldes » (DESIGN_SYSTEM.md) : n'affiche que la devise. */
  masked?: boolean;
}>;

function decimalSeparator(locale: string): string {
  return new Intl.NumberFormat(locale)
    .formatToParts(1.5)
    .filter((part) => part.type === 'decimal')
    .map((part) => part.value)
    .join('');
}

/**
 * Formate un montant pour l'affichage (« 150 000 FCFA », « 12,50 € »), exactement, sans passer par `number`.
 * Le symbole suit le nombre, séparé par une espace insécable.
 */
export function formatMoney(value: Money, options: FormatOptions = {}): string {
  const { locale = 'fr-FR', masked = false } = options;
  const { symbol } = CURRENCIES[value.currency];
  if (masked) return `${MASK}${NBSP}${symbol}`;

  const scale = scaleOf(value.currency);
  const exponent = exponentOf(value.currency);
  const absolute = value.minor < 0n ? -value.minor : value.minor;
  const integerPart = new Intl.NumberFormat(locale, { useGrouping: true }).format(absolute / scale);
  const fraction =
    exponent === 0
      ? ''
      : `${decimalSeparator(locale)}${(absolute % scale).toString().padStart(exponent, '0')}`;
  const sign = value.minor < 0n ? '-' : '';
  return `${sign}${integerPart}${fraction}${NBSP}${symbol}`;
}
