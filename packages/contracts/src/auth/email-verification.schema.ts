import { z } from 'zod';

import { dataEnvelope } from '../common/envelope';

/** Jeton opaque reçu par lien (base64url, 43 caractères en pratique ; SECURITY.md §3.2). */
export const OpaqueTokenSchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const VerifyEmailRequestSchema = z.strictObject({ token: OpaqueTokenSchema });
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

/** `200` de `POST /auth/email/verify` ; un jeton inconnu, consommé ou expiré donne `410 GONE`. */
export const EmailVerifiedResponseSchema = dataEnvelope(z.object({ status: z.literal('verified') }));
export type EmailVerifiedResponse = z.infer<typeof EmailVerifiedResponseSchema>;
