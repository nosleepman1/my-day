/** Jeton d'injection du port de hachage des mots de passe. */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/**
 * Hachage des mots de passe (ADR-006, SECURITY.md §3.3). Les services n'utilisent que ce port,
 * jamais la bibliothèque argon2 directement : les tests injectent des paramètres rapides.
 */
export interface PasswordHasherPort {
  /** Chaîne PHC à stocker dans `users.password_hash`. */
  hash(password: string): Promise<string>;
  /** `false` si le mot de passe ne correspond pas ou si l'empreinte stockée est illisible. */
  verify(storedHash: string, password: string): Promise<boolean>;
  /** Même coût qu'une vérification réelle, pour un compte inconnu : renvoie toujours `false`. */
  verifyAgainstDummy(password: string): Promise<false>;
  /** `true` si l'empreinte a été produite avec d'autres paramètres : rehacher à la connexion réussie. */
  needsRehash(storedHash: string): boolean;
}
