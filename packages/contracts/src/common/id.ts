import { z } from 'zod';

/** Identifiant UUIDv7, généré par l'application (ADR-011). */
export const UuidV7Schema = z.uuid({ version: 'v7' });
export type UuidV7 = z.infer<typeof UuidV7Schema>;
