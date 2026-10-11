import { MoneyError } from './errors';
import { money, negate, type Money } from './money';

type Share = Readonly<{ index: number; base: bigint; remainder: bigint }>;

function byLargestRemainder(a: Share, b: Share): number {
  if (a.remainder === b.remainder) return a.index - b.index;
  return a.remainder > b.remainder ? -1 : 1;
}

/**
 * Répartit un montant selon des ratios entiers sans perdre ni créer d'unité :
 * les unités restantes vont aux plus grandes parties fractionnaires (à égalité, au premier).
 * @throws {MoneyError} `INVALID_RATIOS` si la liste est vide, contient un ratio négatif ou totalise zéro.
 */
export function allocate(value: Money, ratios: readonly bigint[]): Money[] {
  const total = ratios.reduce((acc, ratio) => acc + ratio, 0n);
  if (ratios.length === 0 || total <= 0n || ratios.some((ratio) => ratio < 0n)) {
    throw new MoneyError('INVALID_RATIOS', 'Ratios must be non-negative with a positive total');
  }
  if (value.minor < 0n) return allocate(negate(value), ratios).map(negate);

  const shares: Share[] = ratios.map((ratio, index) => ({
    index,
    base: (value.minor * ratio) / total,
    remainder: (value.minor * ratio) % total,
  }));
  const leftover = value.minor - shares.reduce((acc, share) => acc + share.base, 0n);
  const winners = new Set(
    [...shares]
      .sort(byLargestRemainder)
      .filter((_, position) => BigInt(position) < leftover)
      .map((share) => share.index),
  );
  return shares.map((share) => money(share.base + (winners.has(share.index) ? 1n : 0n), value.currency));
}
