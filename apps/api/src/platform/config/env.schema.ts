import { readFileSync } from 'node:fs';

import { z } from 'zod';

/** Secrets qui, hors `local` et `test`, doivent venir d'un fichier monté `<NOM>_FILE` (INFRASTRUCTURE.md §7). */
const SECRET_KEYS = ['DATABASE_URL'] as const;
const DEPLOYED_ENVS: ReadonlySet<string> = new Set(['staging', 'production']);
const MIN_DEPLOYED_ARGON2_MEMORY_KIB = 19_456;

type IssueContext = z.core.$RefinementCtx;

/** `NODE_ENV=production` si et seulement si l'environnement est déployé : aucun contournement des règles de secrets. */
function checkEnvironmentPair(nodeEnv: string, appEnv: string, ctx: IssueContext): void {
  if ((nodeEnv === 'production') !== DEPLOYED_ENVS.has(appEnv)) {
    ctx.addIssue({ code: 'custom', path: ['NODE_ENV'], message: 'NODE_ENV and APP_ENV are inconsistent' });
  }
}

/** Origine publique du front : en environnement déployé, HTTPS et origine seule (sans chemin ni slash final). */
function checkAppOrigin(appOrigin: string, appEnv: string, ctx: IssueContext): void {
  const url = new URL(appOrigin);
  const isOriginOnly = url.origin === appOrigin;
  const isSecureEnough = url.protocol === 'https:' || !DEPLOYED_ENVS.has(appEnv);
  if (!isOriginOnly || !isSecureEnough) {
    ctx.addIssue({ code: 'custom', path: ['APP_ORIGIN'], message: 'must be an https origin without path' });
  }
}

/** Liste « a@x, b@y » → adresses normalisées (trim, NFC, minuscules), sans entrée vide. */
function splitAddressList(list: string): string[] {
  return list
    .split(',')
    .map((address) => address.trim().normalize('NFC').toLowerCase())
    .filter((address) => address.length > 0);
}

/** En déploiement : argon2id au moins au plancher OWASP (19 Mio) et réponses uniformes actives. */
function checkDeployedAuthCosts(
  memoryKib: number,
  uniformMs: number,
  appEnv: string,
  ctx: IssueContext,
): void {
  if (!DEPLOYED_ENVS.has(appEnv)) return;
  if (memoryKib < MIN_DEPLOYED_ARGON2_MEMORY_KIB) {
    ctx.addIssue({
      code: 'custom',
      path: ['ARGON2_MEMORY_KIB'],
      message: 'too low for a deployed environment',
    });
  }
  if (uniformMs === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['AUTH_UNIFORM_RESPONSE_MS'],
      message: 'must be positive once deployed',
    });
  }
}

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    APP_ENV: z.enum(['local', 'test', 'staging', 'production']),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    /** Origine publique du front ; sert aux contrôles `Origin` et aux liens absolus (ADR-006, ADR-038). */
    APP_ORIGIN: z.url({ protocol: /^https?$/ }),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//, 'must be a PostgreSQL connection URL'),
    /** Nombre de proxys de confiance devant l'API (Caddy, réécriture Vercel). */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    /** PHASE-01 : SMTP uniquement (Mailpit en local et en test) ; `brevo`/`resend` en PHASE-03. */
    MAIL_DRIVER: z.enum(['smtp']).default('smtp'),
    /** IP plutôt que `localhost` : nodemailer résout lui-même le nom, ce qui expire parfois sous Windows. */
    SMTP_HOST: z.string().min(1).default('127.0.0.1'),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1025),
    /** Expéditeur, par exemple `ORBIT <no-reply@orbit.example.com>` ; une seule ligne (aucune injection d'en-tête). */
    MAIL_FROM: z
      .string()
      .min(3)
      .regex(/^[^\r\n]+$/, 'must be a single line'),
    /** ADR-026 : `allowlist` (sur invitation) par défaut jusqu'à la fin de PHASE-08. */
    REGISTRATION_MODE: z.enum(['closed', 'allowlist', 'open']).default('allowlist'),
    /** Adresses autorisées en mode `allowlist`, séparées par des virgules, normalisées comme `users.email`. */
    REGISTRATION_ALLOWLIST: z.string().default('').transform(splitAddressList).pipe(z.array(z.email())),
    /** ADR-006, ADR-039 : 64 Mio et 3 passes ; des valeurs basses ne sont admises que hors déploiement. */
    ARGON2_MEMORY_KIB: z.coerce.number().int().min(1_024).max(1_048_576).default(65_536),
    ARGON2_ITERATIONS: z.coerce.number().int().min(1).max(10).default(3),
    /** Durée plancher des réponses uniformes d'inscription et de renvoi (SECURITY.md §3.8). */
    AUTH_UNIFORM_RESPONSE_MS: z.coerce.number().int().min(0).max(5_000).default(750),
  })
  .superRefine((env, ctx) => {
    checkEnvironmentPair(env.NODE_ENV, env.APP_ENV, ctx);
    checkAppOrigin(env.APP_ORIGIN, env.APP_ENV, ctx);
    checkDeployedAuthCosts(env.ARGON2_MEMORY_KIB, env.AUTH_UNIFORM_RESPONSE_MS, env.APP_ENV, ctx);
    if (env.LOG_LEVEL === 'trace' && DEPLOYED_ENVS.has(env.APP_ENV)) {
      ctx.addIssue({
        code: 'custom',
        path: ['LOG_LEVEL'],
        message: 'trace is forbidden in deployed environments',
      });
    }
  });

export type Env = Readonly<z.infer<typeof EnvSchema>>;
export type EnvSource = Readonly<Record<string, string | undefined>>;
export type SecretReader = (path: string) => string;

/** Configuration invalide : le message ne contient que des noms de variables, jamais leurs valeurs. */
export class ConfigurationError extends Error {
  override readonly name = 'ConfigurationError';
}

const readSecretFile: SecretReader = (path) => readFileSync(path, 'utf8');

function readSecret(key: string, file: string, reader: SecretReader): string {
  try {
    return reader(file).trim();
  } catch (error: unknown) {
    throw new ConfigurationError(`Secret ${key} cannot be read from ${key}_FILE`, { cause: error });
  }
}

function resolveSecrets(source: EnvSource, reader: SecretReader): Record<string, string | undefined> {
  const deployed = DEPLOYED_ENVS.has(source['APP_ENV'] ?? '');
  const resolved: Record<string, string | undefined> = { ...source };
  for (const key of SECRET_KEYS) {
    const file = source[`${key}_FILE`];
    if (file !== undefined) {
      resolved[key] = readSecret(key, file, reader);
    } else if (deployed && source[key] !== undefined) {
      throw new ConfigurationError(`Secret ${key} must be provided via ${key}_FILE`);
    }
  }
  return resolved;
}

/**
 * Valide la configuration au démarrage ; l'API refuse de démarrer si elle est invalide (PHASE-00 §7).
 * @throws {ConfigurationError} avec la liste des variables fautives, sans leurs valeurs.
 */
export function loadEnv(source: EnvSource, reader: SecretReader = readSecretFile): Env {
  const parsed = EnvSchema.safeParse(resolveSecrets(source, reader));
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))].join(', ');
    throw new ConfigurationError(`Invalid configuration: ${names}`);
  }
  return Object.freeze(parsed.data);
}
