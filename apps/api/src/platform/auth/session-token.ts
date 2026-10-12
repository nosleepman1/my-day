import { createHash, randomBytes } from 'node:crypto';

/** 32 octets aléatoires (256 bits), encodés en base64url : 43 caractères (SECURITY.md §3.2). */
export const OPAQUE_TOKEN_BYTES = 32;

export type OpaqueToken = Readonly<{
  /** Valeur remise au client (cookie ou lien) ; jamais stockée ni journalisée. */
  token: string;
  /** Empreinte SHA-256 stockée en base (32 octets). */
  hash: Buffer;
}>;

/** Empreinte SHA-256 d'un jeton présenté par le client, pour le retrouver en base. */
export function hashOpaqueToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

/** Jeton de session, de vérification d'e-mail ou de réinitialisation : seule l'empreinte est persistée. */
export function generateOpaqueToken(): OpaqueToken {
  const token = randomBytes(OPAQUE_TOKEN_BYTES).toString('base64url');
  return { token, hash: hashOpaqueToken(token) };
}
