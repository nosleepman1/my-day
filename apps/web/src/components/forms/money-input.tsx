import { useImperativeHandle, useLayoutEffect, useRef, type ComponentProps, type JSX } from 'react';

import { CURRENCIES, exponentOf, type CurrencyCode } from '@orbit/money';

import { cn } from '@/lib/cn';

import { groupMoneyInput, normalizeMoneyInput } from './money-input-value';

type MoneyInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'inputMode'> &
  Readonly<{
    /** Valeur normalisée (chiffres, `,` décimale) : jamais un `number` (ADR-008). */
    value: string;
    onValueChange: (value: string) => void;
    currency: CurrencyCode;
  }>;

/**
 * Position logique du curseur dans la frappe brute : chiffres et séparateur décimal. Le point compte
 * aussi (claviers mobiles), car `normalizeMoneyInput` le convertit en virgule (revue PHASE-02 n° 1).
 */
export function digitsBefore(text: string, caret: number): number {
  return text.slice(0, caret).replace(/[^\d,.]/g, '').length;
}

function caretAfterDigits(text: string, digits: number): number {
  let seen = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (seen === digits) return index;
    if (/[\d,]/.test(text.charAt(index))) seen += 1;
  }
  return text.length;
}

/**
 * Saisie d'un montant (DESIGN_SYSTEM.md §5.3) : groupes de milliers pendant la frappe, curseur conservé,
 * suffixe de devise non éditable, clavier numérique. La conversion en unités mineures est faite par
 * `moneyInputToMinor` à la soumission.
 */
export function MoneyInput({
  value,
  onValueChange,
  currency,
  className,
  ref,
  ...props
}: MoneyInputProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  // La ref de l'appelant (react-hook-form, focus) reçoit l'élément sans écraser celle du curseur.
  useImperativeHandle<HTMLInputElement | null, HTMLInputElement | null>(ref, () => inputRef.current, []);
  const pendingCaret = useRef<number | null>(null);
  const display = groupMoneyInput(value);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input === null || pendingCaret.current === null) return;
    const caret = caretAfterDigits(display, pendingCaret.current);
    input.setSelectionRange(caret, caret);
    pendingCaret.current = null;
  }, [display]);

  return (
    <div className="relative flex items-center">
      <input
        ref={inputRef}
        type="text"
        inputMode={exponentOf(currency) === 0 ? 'numeric' : 'decimal'}
        enterKeyHint="next"
        autoComplete="off"
        value={display}
        onChange={(event) => {
          const { value: raw, selectionStart } = event.currentTarget;
          const next = normalizeMoneyInput(raw, currency);
          // Caractère refusé : l'affichage ne change pas, aucun curseur en attente ne doit subsister.
          pendingCaret.current = next === value ? null : digitsBefore(raw, selectionStart ?? raw.length);
          onValueChange(next);
        }}
        className={cn(
          'min-h-11 w-full rounded-md border border-input-border bg-surface py-2 pr-16 pl-3 text-right text-body tabular-nums text-foreground aria-invalid:border-danger',
          className,
        )}
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 text-small text-muted-foreground"
      >
        {CURRENCIES[currency].symbol}
      </span>
    </div>
  );
}
