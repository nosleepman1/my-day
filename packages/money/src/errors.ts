/** Causes d'erreur stables de `@orbit/money`, à traduire par l'appelant (API ou front). */
export type MoneyErrorCode =
  | 'UNKNOWN_CURRENCY'
  | 'CURRENCY_MISMATCH'
  | 'INVALID_AMOUNT'
  | 'AMOUNT_OUT_OF_RANGE'
  | 'TOO_MANY_DECIMALS'
  | 'INVALID_DECIMAL'
  | 'INVALID_RATIOS';

/** Erreur levée par toute opération monétaire invalide. Le message est technique, jamais affiché tel quel. */
export class MoneyError extends Error {
  override readonly name = 'MoneyError';

  constructor(
    readonly code: MoneyErrorCode,
    message: string,
  ) {
    super(message);
  }
}
