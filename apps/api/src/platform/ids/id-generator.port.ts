/**
 * Source d'identifiants UUIDv7 (ADR-011). Les modules l'injectent au lieu d'appeler `crypto.randomUUID()`,
 * ce qui rend les tests déterministes (`SequentialIdGenerator`, PHASE-01).
 */
export interface IdGeneratorPort {
  next(): string;
}
