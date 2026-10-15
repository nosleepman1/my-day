import { z } from 'zod';

import { InstantSchema } from '../common/dates';
import { listEnvelope } from '../common/envelope';
import { UuidV7Schema } from '../common/id';

/** Session active vue par son titulaire (API.md §14.3) : IP tronquée, appareil approximatif. */
export const SessionSummarySchema = z.object({
  id: UuidV7Schema,
  current: z.boolean(),
  createdAt: InstantSchema,
  lastSeenAt: InstantSchema,
  ip: z.string().nullable(),
  device: z.string().nullable(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

/** Liste courte (20 sessions au plus) : pas de pagination. */
export const SessionListResponseSchema = z.object({ data: z.array(SessionSummarySchema) });
export type SessionListResponse = z.infer<typeof SessionListResponseSchema>;

export const SessionIdParamSchema = z.strictObject({ id: UuidV7Schema });
export type SessionIdParam = z.infer<typeof SessionIdParamSchema>;

/** Événement de l'historique de connexion (`GET /me/login-events`), IP tronquée. */
export const LoginEventSummarySchema = z.object({
  id: UuidV7Schema,
  eventType: z.string(),
  failureCode: z.string().nullable(),
  occurredAt: InstantSchema,
  ip: z.string().nullable(),
  device: z.string().nullable(),
});
export type LoginEventSummary = z.infer<typeof LoginEventSummarySchema>;

export const LoginEventListResponseSchema = listEnvelope(LoginEventSummarySchema);
export type LoginEventListResponse = z.infer<typeof LoginEventListResponseSchema>;
