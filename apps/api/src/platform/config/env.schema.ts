import { readFileSync } from 'node:fs';

import { z } from 'zod';

/** Secrets qui, hors `local` et `test`, doivent venir d'un fichier monté `<NOM>_FILE` (INFRASTRUCTURE.md §7). */
const SECRET_KEYS = ['DATABASE_URL', 'RATE_LIMIT_HMAC_KEY', 'SMTP_PASSWORD'] as const;
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

type DeployedFields = Readonly<{
  APP_ENV: string;
  API_PUBLIC_URL?: string | undefined;
  SENTRY_DSN?: string | undefined;
  SMTP_SECURITY: string;
  SMTP_USER?: string | undefined;
  SMTP_PASSWORD?: string | undefined;
  MAIL_ALLOWLIST: readonly string[];
}>;

/**
 * Exigences propres aux environnements déployés (PHASE-03) : URL publique HTTPS de l'API, Sentry, SMTP
 * chiffré et authentifié (revue PHASE-01, M8) et, en staging, liste blanche des destinataires.
 */
function checkDeployedServices(env: DeployedFields, ctx: IssueContext): void {
  if (!DEPLOYED_ENVS.has(env.APP_ENV)) return;
  const missing = (path: string, message: string): void => {
    ctx.addIssue({ code: 'custom', path: [path], message });
  };
  if (env.API_PUBLIC_URL?.startsWith('https://') !== true) {
    missing('API_PUBLIC_URL', 'an https URL is required once deployed');
  }
  if (env.SENTRY_DSN === undefined) missing('SENTRY_DSN', 'required once deployed');
  if (env.SMTP_SECURITY === 'none') missing('SMTP_SECURITY', 'encrypted SMTP is required once deployed');
  if (env.SMTP_USER === undefined || env.SMTP_PASSWORD === undefined) {
    missing('SMTP_USER', 'SMTP credentials are required once deployed');
  }
  if (env.APP_ENV === 'staging' && env.MAIL_ALLOWLIST.length === 0) {
    missing('MAIL_ALLOWLIST', 'staging only sends to allowlisted recipients');
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
    /** URL publique directe de l'API (webhooks entrants, n8n) ; jamais utilisée par le navigateur. */
    API_PUBLIC_URL: z.url({ protocol: /^https?$/ }).optional(),
    /** SHA de l'image déployée, journalisé au démarrage et transmis à Sentry ; jamais exposé par HTTP. */
    APP_VERSION: z
      .string()
      .regex(/^[\w.-]{1,64}$/)
      .default('dev'),
    /** Projet Sentry SaaS « api » (région UE) ; absent en local et en test. */
    SENTRY_DSN: z.url({ protocol: /^https$/ }).optional(),
    SENTRY_ENVIRONMENT: z.string().min(1).max(32).optional(),
    /**
     * SMTP partout (Mailpit en local, relais SMTP du fournisseur transactionnel en déploiement, ADR-042) :
     * un seul adaptateur, testé de bout en bout.
     */
    MAIL_DRIVER: z.enum(['smtp']).default('smtp'),
    /** IP plutôt que `localhost` : nodemailer résout lui-même le nom, ce qui expire parfois sous Windows. */
    SMTP_HOST: z.string().min(1).default('127.0.0.1'),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1025),
    /** `none` (Mailpit), `starttls` (port 587) ou `tls` (port 465) ; chiffré obligatoire en déploiement. */
    SMTP_SECURITY: z.enum(['none', 'starttls', 'tls']).default('none'),
    SMTP_USER: z.string().min(1).optional(),
    /** Secret (`SMTP_PASSWORD_FILE` en déploiement). */
    SMTP_PASSWORD: z.string().min(1).optional(),
    /** Staging : destinataires autorisés (adresses ou `@domaine`) ; tout autre envoi est refusé. */
    MAIL_ALLOWLIST: z.string().default('').transform(splitAddressList),
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
    /** SECURITY.md §3.2 : inactivité glissante et durée absolue des sessions. */
    SESSION_IDLE_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    SESSION_ABSOLUTE_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    /** Secret : pseudonymisation HMAC des IP et adresses dans les compteurs (SECURITY.md §3.7). */
    RATE_LIMIT_HMAC_KEY: z.string().min(32),
    /** Désactivable dans les tests uniquement (refusé en déploiement). */
    RATE_LIMIT_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    /** Délai progressif par échec de connexion récent (SECURITY.md §3.7) ; 0 dans les tests. */
    LOGIN_DELAY_UNIT_MS: z.coerce.number().int().min(0).max(1_000).default(250),
  })
  .superRefine((env, ctx) => {
    checkEnvironmentPair(env.NODE_ENV, env.APP_ENV, ctx);
    checkAppOrigin(env.APP_ORIGIN, env.APP_ENV, ctx);
    checkDeployedAuthCosts(env.ARGON2_MEMORY_KIB, env.AUTH_UNIFORM_RESPONSE_MS, env.APP_ENV, ctx);
    checkDeployedServices(env, ctx);
    if (DEPLOYED_ENVS.has(env.APP_ENV) && (!env.RATE_LIMIT_ENABLED || env.LOGIN_DELAY_UNIT_MS === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['RATE_LIMIT_ENABLED'],
        message: 'abuse protections cannot be disabled once deployed',
      });
    }
    if (env.SESSION_IDLE_DAYS > env.SESSION_ABSOLUTE_DAYS) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_IDLE_DAYS'],
        message: 'must not exceed SESSION_ABSOLUTE_DAYS',
      });
    }
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
