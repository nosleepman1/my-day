/**
 * Modules activables par l'utilisateur (`user_preferences.enabled_modules`, ADR-024, DATA_MODEL.md).
 * La zone Dev n'en fait jamais partie : elle dépend du rôle ADMIN.
 */
export const USER_MODULES = [
  'ideas',
  'tasks',
  'projects',
  'notes',
  'finance',
  'debts',
  'calendar',
  'documents',
  'pro',
  'goals',
  'habits',
  'learning',
  'journal',
  'automations',
  'integrations',
  'ai',
] as const;

export type UserModule = (typeof USER_MODULES)[number];
