/**
 * Clés de requête partagées entre modules (FRONTEND.md §4.2) : la session (`/me*`) est lue par les
 * gardes, le shell, l'authentification et les paramètres.
 */
export const sessionKeys = {
  all: ['me'] as const,
  me: () => [...sessionKeys.all, 'profile'] as const,
  preferences: () => [...sessionKeys.all, 'preferences'] as const,
  sessions: () => [...sessionKeys.all, 'sessions'] as const,
  loginEvents: () => [...sessionKeys.all, 'login-events'] as const,
};

type Params = Readonly<Record<string, string | undefined>>;
type Resource = 'ideas' | 'projects' | 'tasks' | 'notes';

/**
 * Organisation (M03) : invalidée en bloc après chaque écriture, y compris par la capture rapide et le
 * rejeu de la file hors ligne, qui vivent dans le chunk initial.
 */
export const organizationKeys = {
  all: ['organization'] as const,
  list: (resource: Resource, params: Params) => [...organizationKeys.all, resource, 'list', params] as const,
  item: (resource: Resource, id: string) => [...organizationKeys.all, resource, 'item', id] as const,
  detail: (resource: Resource, id: string, part: string) =>
    [...organizationKeys.all, resource, 'item', id, part] as const,
  tags: () => [...organizationKeys.all, 'tags'] as const,
};
