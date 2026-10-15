import { z } from 'zod';

import { OpaqueTokenSchema } from '../auth/email-verification.schema';
import { SessionUserSchema } from '../auth/login.schema';
import { EmailSchema } from '../auth/registration.schema';
import { InstantSchema, TimezoneSchema } from '../common/dates';
import { dataEnvelope } from '../common/envelope';

import { USER_MODULES } from './user-modules';

export const LOCALES = ['fr', 'en'] as const;
export const DATE_FORMATS = ['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'] as const;
export const UI_THEMES = ['SYSTEM', 'LIGHT', 'DARK'] as const;
/** Devises proposées tant que la table `currencies` n'existe pas (PHASE-01 §3) : celles de `@orbit/money`. */
export const PREFERENCE_CURRENCIES = ['XOF', 'EUR', 'USD'] as const;

export const UserModuleSchema = z.enum(USER_MODULES);

/** `GET /me` et `PATCH /me` (API.md §14.3). */
export const MeResponseSchema = dataEnvelope(SessionUserSchema);
export type MeResponse = z.infer<typeof MeResponseSchema>;

export const UpdateProfileRequestSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(80),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const PreferencesSchema = z.object({
  locale: z.enum(LOCALES),
  timezone: z.string(),
  defaultCurrency: z.enum(PREFERENCE_CURRENCIES),
  dateFormat: z.enum(DATE_FORMATS),
  weekStartsOn: z.number().int().min(1).max(7),
  theme: z.enum(UI_THEMES),
  enabledModules: z.array(UserModuleSchema),
  onboardingCompletedAt: InstantSchema.nullable(),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

export const PreferencesResponseSchema = dataEnvelope(PreferencesSchema);
export type PreferencesResponse = z.infer<typeof PreferencesResponseSchema>;

/** `PATCH /me/preferences` : au moins un champ ; `enabledModules` sans doublon ni module ADMIN (ADR-024). */
export const UpdatePreferencesRequestSchema = z
  .strictObject({
    locale: z.enum(LOCALES).optional(),
    timezone: TimezoneSchema.optional(),
    defaultCurrency: z.enum(PREFERENCE_CURRENCIES).optional(),
    dateFormat: z.enum(DATE_FORMATS).optional(),
    weekStartsOn: z.number().int().min(1).max(7).optional(),
    theme: z.enum(UI_THEMES).optional(),
    enabledModules: z
      .array(UserModuleSchema)
      .refine((modules) => new Set(modules).size === modules.length, 'Module en double.')
      .optional(),
    /** Marque la fin de l'onboarding ; ne peut pas être annulée. */
    onboardingCompleted: z.literal(true).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'Au moins un champ est requis.');
export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequestSchema>;

/** `POST /me/email` (ré-authentification récente exigée). */
export const ChangeEmailRequestSchema = z.strictObject({ newEmail: EmailSchema });
export type ChangeEmailRequest = z.infer<typeof ChangeEmailRequestSchema>;

/** `POST /auth/email/change/confirm` : jeton envoyé à la nouvelle adresse. */
export const ConfirmEmailChangeRequestSchema = z.strictObject({ token: OpaqueTokenSchema });
export type ConfirmEmailChangeRequest = z.infer<typeof ConfirmEmailChangeRequestSchema>;

/** `POST /me/password` : le mot de passe actuel vaut ré-authentification (SECURITY.md §3.6). */
export const ChangePasswordRequestSchema = z.strictObject({
  currentPassword: z.string().min(1).max(1_024),
  newPassword: z.string().min(1).max(1_024),
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;
