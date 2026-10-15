import { createHash } from 'node:crypto';

/**
 * Sérialisation JSON canonique (clés triées alphabétiquement, sans espaces)
 * pour un calcul d'empreinte SHA-256 déterministe (API.md §9.1).
 */
export function canonicalJsonString(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonString).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  const pairs = entries
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJsonString(v)}`);
  return `{${pairs.join(',')}}`;
}

/**
 * Calcule l'empreinte SHA-256 d'un corps de requête sous forme canonique.
 */
export function canonicalJsonHash(value: unknown): Buffer {
  const serialized = canonicalJsonString(value ?? {});
  return createHash('sha256').update(serialized, 'utf8').digest();
}
