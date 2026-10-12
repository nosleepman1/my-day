/**
 * Codec du format PHC d'argon2id (`$argon2id$v=19$m=…,t=…,p=…$<sel>$<empreinte>`, base64 standard sans
 * remplissage), compatible avec les bibliothèques argon2 usuelles. Les bornes empêchent qu'une empreinte
 * stockée et falsifiée impose un coût de calcul démesuré.
 */
export type Argon2Params = Readonly<{ memoryCost: number; timeCost: number; parallelism: number }>;

export type ParsedArgon2idPhc = Readonly<{ params: Argon2Params; salt: Buffer; digest: Buffer }>;

const ARGON2_VERSION = 19;
/** Kio : 8 Kio à 1 Gio. */
const MEMORY_BOUNDS = { min: 8, max: 1_048_576 } as const;
const TIME_BOUNDS = { min: 1, max: 10 } as const;
const PARALLELISM_BOUNDS = { min: 1, max: 16 } as const;
/** Octets. */
const SALT_BOUNDS = { min: 8, max: 64 } as const;
const DIGEST_BOUNDS = { min: 16, max: 64 } as const;

const PHC_PATTERN = /^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

type Bounds = Readonly<{ min: number; max: number }>;

function within(value: number, bounds: Bounds): boolean {
  return Number.isSafeInteger(value) && value >= bounds.min && value <= bounds.max;
}

function toUnpaddedBase64(bytes: Buffer): string {
  return bytes.toString('base64').replace(/=+$/, '');
}

export function formatArgon2idPhc(params: Argon2Params, salt: Buffer, digest: Buffer): string {
  const { memoryCost, timeCost, parallelism } = params;
  return `$argon2id$v=${ARGON2_VERSION}$m=${memoryCost},t=${timeCost},p=${parallelism}$${toUnpaddedBase64(salt)}$${toUnpaddedBase64(digest)}`;
}

/** `null` si la chaîne n'est pas une empreinte argon2id v19 lisible et dans les bornes. */
export function parseArgon2idPhc(phc: string): ParsedArgon2idPhc | null {
  const match = PHC_PATTERN.exec(phc);
  if (match === null) return null;
  const [, version, memory, time, lanes, saltB64, digestB64] = match;
  const params: Argon2Params = {
    memoryCost: Number(memory),
    timeCost: Number(time),
    parallelism: Number(lanes),
  };
  const salt = Buffer.from(saltB64 ?? '', 'base64');
  const digest = Buffer.from(digestB64 ?? '', 'base64');

  const isValid =
    Number(version) === ARGON2_VERSION &&
    within(params.memoryCost, MEMORY_BOUNDS) &&
    within(params.timeCost, TIME_BOUNDS) &&
    within(params.parallelism, PARALLELISM_BOUNDS) &&
    within(salt.length, SALT_BOUNDS) &&
    within(digest.length, DIGEST_BOUNDS);
  return isValid ? { params, salt, digest } : null;
}
