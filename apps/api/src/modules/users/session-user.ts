import type { SessionUser } from '@orbit/contracts';

/** Compte tel qu'exposé au front (`GET /me`, réponse de connexion) ; jamais d'empreinte ni de statut interne. */
export type ProfileRecord = Readonly<{
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'ADMIN';
  emailVerifiedAt: Date | null;
}>;

/** `mfaEnabled` vaut `false` jusqu'à PHASE-13. */
export function toSessionUser(profile: ProfileRecord): SessionUser {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    role: profile.role,
    emailVerifiedAt: profile.emailVerifiedAt?.toISOString() ?? null,
    mfaEnabled: false,
  };
}
