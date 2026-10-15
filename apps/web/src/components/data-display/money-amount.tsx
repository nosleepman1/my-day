import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { formatMoney, isCurrencyCode, parseMinor } from '@orbit/money';

import { cn } from '@/lib/cn';

type MoneyAmountProps = Readonly<{
  /** Unités mineures, chaîne de l'API (`"150000"`). */
  minor: string;
  /** Code ISO 4217 de l'API ; une devise inconnue est affichée brute. */
  currency: string;
  kind?: 'balance' | 'in' | 'out' | 'neutral';
  /** Mode « masquer les soldes » (DESIGN_SYSTEM.md §5.2). */
  hidden?: boolean;
  className?: string;
}>;

const MINUS = '−';

const KIND_CLASS = {
  balance: 'text-foreground',
  in: 'text-money-in',
  out: 'text-money-out',
  neutral: 'text-foreground',
} as const;

/**
 * Seul composant qui affiche de l'argent (DESIGN_SYSTEM.md §5.2, §8.1) : formatage exact par
 * `@orbit/money`, signe `+` / `−` selon le sens, jamais de conversion en `number`.
 */
export function MoneyAmount({
  minor,
  currency,
  kind = 'neutral',
  hidden = false,
  className,
}: MoneyAmountProps): JSX.Element {
  const { t } = useTranslation();
  if (!isCurrencyCode(currency)) return <span className={className}>{minor}</span>;
  const value = parseMinor(minor, currency);
  const formatted = formatMoney(value, { masked: hidden }).replace('-', MINUS);
  const sign =
    kind === 'in' && !hidden ? '+' : kind === 'out' && !hidden && !formatted.startsWith(MINUS) ? MINUS : '';
  return (
    <span
      className={cn('tabular-nums whitespace-nowrap', KIND_CLASS[kind], className)}
      {...(hidden ? { 'aria-label': t('money.hidden') } : {})}
    >
      {`${sign}${formatted}`}
    </span>
  );
}
