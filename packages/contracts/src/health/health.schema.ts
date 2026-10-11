import { z } from 'zod';

import { dataEnvelope } from '../common/envelope';

/** Réponse de `/health/live` et `/health/ready` : aucun détail interne (API.md §14.2). */
export const HealthStatusSchema = z.object({ status: z.literal('ok') }).strict();
export const HealthResponseSchema = dataEnvelope(HealthStatusSchema);
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
