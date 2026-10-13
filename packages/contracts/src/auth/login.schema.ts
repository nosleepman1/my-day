import { z } from 'zod';

import { InstantSchema } from '../common/dates';
import { dataEnvelope } from '../common/envelope';
import { UuidV7Schema } from '../common/id';

import { EmailSchema } from './registration.schema';

export const UserRoleSchema = z.enum(['USER', 'ADMIN']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const LoginRequestSchema = z.strictObject({
  email: EmailSchema,
  password: z.string().min(1).max(1_024),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** Utilisateur exposé au front (API.md §14.3, `GET /me`) : jamais d'empreinte ni de donnée interne. */
export const SessionUserSchema = z.object({
  id: UuidV7Schema,
  email: z.string(),
  displayName: z.string(),
  role: UserRoleSchema,
  emailVerifiedAt: InstantSchema.nullable(),
  mfaEnabled: z.boolean(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

/** `mfaRequired` vaut toujours `false` avant PHASE-13. Le jeton n'apparaît que dans le cookie. */
export const LoginResponseSchema = dataEnvelope(
  z.object({ user: SessionUserSchema, mfaRequired: z.boolean() }),
);
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
