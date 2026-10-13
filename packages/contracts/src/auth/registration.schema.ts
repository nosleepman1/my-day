import { z } from 'zod';

import { dataEnvelope } from '../common/envelope';

/** RFC 5321 : 254 caractères au plus. La normalisation (minuscules, NFC) est faite par l'API. */
export const EmailSchema = z.string().trim().max(254).pipe(z.email());

/** La politique (12 à 128 points de code) est appliquée par l'API ; ici, seulement une borne anti-abus. */
const PasswordInputSchema = z.string().min(1).max(1_024);

export const RegisterRequestSchema = z.strictObject({
  email: EmailSchema,
  password: PasswordInputSchema,
  displayName: z.string().trim().min(1).max(80).optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const ResendVerificationRequestSchema = z.strictObject({ email: EmailSchema });
export type ResendVerificationRequest = z.infer<typeof ResendVerificationRequestSchema>;

/** Réponse `202` uniforme des routes qui ne doivent pas révéler l'existence d'un compte (SECURITY.md §3.8). */
export const AcceptedResponseSchema = dataEnvelope(z.object({ status: z.literal('accepted') }));
export type AcceptedResponse = z.infer<typeof AcceptedResponseSchema>;
