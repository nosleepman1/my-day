/** Jeton d'injection du résolveur de session, implémenté par `modules/auth` (SessionsService). */
export const SESSION_RESOLVER = Symbol('SESSION_RESOLVER');

export type UserRole = 'USER' | 'ADMIN';

/** Session valide attachée à la requête par le guard global. */
export type AuthenticatedSession = Readonly<{ sessionId: string; userId: string; role: UserRole }>;

export interface SessionResolverPort {
  /** `null` si la session est inconnue, révoquée, expirée ou si l'utilisateur n'est plus actif. */
  resolve(token: string): Promise<AuthenticatedSession | null>;
}
