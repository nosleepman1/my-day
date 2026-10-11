/**
 * Division entière arrondie « half-up » : la seule règle d'arrondi d'ORBIT (ADR-008, FINANCE_RULES §2.2).
 * Pour n ≥ 0 : floor((2n + d) / 2d). Pour n < 0, l'arrondi est symétrique (-round(-n)).
 * @throws {RangeError} si le diviseur n'est pas strictement positif.
 */
export function roundHalfUp(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new RangeError('roundHalfUp: divisor must be strictly positive');
  if (n < 0n) return -roundHalfUp(-n, d);
  return (2n * n + d) / (2n * d);
}
