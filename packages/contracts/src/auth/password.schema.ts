import { z } from 'zod';

import { OpaqueTokenSchema } from './email-verification.schema';
import { EmailSchema } from './registration.schema';

/** La politique (12 à 128 points de code) est appliquée par l'API ; ici, seulement une borne anti-abus. */
const PasswordInputSchema = z.string().min(1).max(1_024);

export const ForgotPasswordRequestSchema = z.strictObject({ email: EmailSchema });
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ResetPasswordRequestSchema = z.strictObject({
  token: OpaqueTokenSchema,
  newPassword: PasswordInputSchema,
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const ReauthRequestSchema = z.strictObject({ password: PasswordInputSchema });
export type ReauthRequest = z.infer<typeof ReauthRequestSchema>;
