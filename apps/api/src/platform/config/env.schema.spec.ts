import { describe, expect, it } from 'vitest';

import { ConfigurationError, loadEnv } from './env.schema';

const VALID = {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  APP_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://orbit_app:fake-password@localhost:5432/orbit',
  MAIL_FROM: 'ORBIT <no-reply@orbit.localhost>',
  RATE_LIMIT_HMAC_KEY: 'test-only-rate-limit-key-0123456789abcdef',
} as const;

const noSecretFile = (): string => {
  throw new Error('no secret file expected');
};

/** Configuration de staging complète, valeurs fictives ; les secrets viennent de `*_FILE`. */
const DEPLOYED = {
  NODE_ENV: 'production',
  APP_ENV: 'staging',
  APP_ORIGIN: 'https://orbit.example.com',
  API_PUBLIC_URL: 'https://api-staging.example.com',
  SENTRY_DSN: 'https://fakekey@o0.ingest.de.sentry.io/1',
  MAIL_FROM: 'ORBIT <no-reply@orbit.example.com>',
  SMTP_HOST: 'smtp-relay.example.com',
  SMTP_PORT: '587',
  SMTP_SECURITY: 'starttls',
  SMTP_USER: 'fake-smtp-user',
  MAIL_ALLOWLIST: '@Example.com, owner@example.org',
  DATABASE_URL_FILE: '/run/secrets/database_url',
  RATE_LIMIT_HMAC_KEY_FILE: '/run/secrets/rate_limit_hmac_key',
  SMTP_PASSWORD_FILE: '/run/secrets/smtp_password',
} as const;

const DEPLOYED_SECRETS: Readonly<Record<string, string>> = {
  '/run/secrets/database_url': 'postgresql://orbit_app:fake@db:5432/orbit\n',
  '/run/secrets/rate_limit_hmac_key': 'file-only-rate-limit-key-0123456789abcdef\n',
  '/run/secrets/smtp_password': 'fake-smtp-password\n',
};

const deployedSecrets = (path: string): string => {
  const secret = DEPLOYED_SECRETS[path];
  if (secret === undefined) throw new Error(`unexpected secret file ${path}`);
  return secret;
};

describe('loadEnv (INFRASTRUCTURE.md §6.3)', () => {
  it('parses a valid configuration and applies defaults', () => {
    const env = loadEnv(VALID, noSecretFile);
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.TRUST_PROXY_HOPS).toBe(0);
    expect(Object.isFrozen(env)).toBe(true);
  });

  it('refuses a missing variable and lists names only, never values', () => {
    const { DATABASE_URL: _omitted, ...withoutDb } = VALID;
    expect(() => loadEnv({ ...withoutDb, APP_ORIGIN: 'not-a-url' }, noSecretFile)).toThrow(
      ConfigurationError,
    );
    try {
      loadEnv({ ...withoutDb, APP_ORIGIN: 'not-a-url' }, noSecretFile);
    } catch (error: unknown) {
      const message = (error as Error).message;
      expect(message).toContain('DATABASE_URL');
      expect(message).toContain('APP_ORIGIN');
      expect(message).not.toContain('not-a-url');
    }
  });

  it('refuses a plain-text secret in production', () => {
    expect(() => loadEnv({ ...VALID, NODE_ENV: 'production', APP_ENV: 'production' }, noSecretFile)).toThrow(
      /DATABASE_URL must be provided via DATABASE_URL_FILE/,
    );
  });

  it('reads secrets from *_FILE in deployed environments', () => {
    const env = loadEnv(DEPLOYED, deployedSecrets);
    expect(env.DATABASE_URL).toBe('postgresql://orbit_app:fake@db:5432/orbit');
    expect(env.RATE_LIMIT_HMAC_KEY).toBe('file-only-rate-limit-key-0123456789abcdef');
    expect(env.SMTP_PASSWORD).toBe('fake-smtp-password');
    expect(env.MAIL_ALLOWLIST).toEqual(['@example.com', 'owner@example.org']);
  });

  it('requires the deployed services: public API URL, Sentry, encrypted and authenticated SMTP (PHASE-03)', () => {
    const { API_PUBLIC_URL: _url, SENTRY_DSN: _dsn, SMTP_USER: _user, ...partial } = DEPLOYED;
    try {
      loadEnv({ ...partial, SMTP_SECURITY: 'none' }, deployedSecrets);
      expect.unreachable();
    } catch (error: unknown) {
      const message = (error as Error).message;
      for (const name of ['API_PUBLIC_URL', 'SENTRY_DSN', 'SMTP_SECURITY', 'SMTP_USER']) {
        expect(message).toContain(name);
      }
    }
    expect(() => loadEnv({ ...DEPLOYED, API_PUBLIC_URL: 'http://api.example.com' }, deployedSecrets)).toThrow(
      /API_PUBLIC_URL/,
    );
  });

  it('requires a mail allowlist in staging only', () => {
    expect(() => loadEnv({ ...DEPLOYED, MAIL_ALLOWLIST: '' }, deployedSecrets)).toThrow(/MAIL_ALLOWLIST/);
    const production = loadEnv({ ...DEPLOYED, APP_ENV: 'production', MAIL_ALLOWLIST: '' }, deployedSecrets);
    expect(production.MAIL_ALLOWLIST).toEqual([]);
  });

  it('keeps local defaults for the new optional settings', () => {
    const env = loadEnv(VALID, noSecretFile);
    expect(env.APP_VERSION).toBe('dev');
    expect(env.SMTP_SECURITY).toBe('none');
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.API_PUBLIC_URL).toBeUndefined();
  });

  it('refuses the trace log level outside local and test', () => {
    const { DATABASE_URL: _plain, RATE_LIMIT_HMAC_KEY: _key, ...rest } = VALID;
    expect(() =>
      loadEnv(
        {
          ...rest,
          APP_ENV: 'production',
          NODE_ENV: 'production',
          LOG_LEVEL: 'trace',
          DATABASE_URL_FILE: '/x',
          RATE_LIMIT_HMAC_KEY_FILE: '/run/secrets/rate_limit_hmac_key',
        },
        () => VALID.DATABASE_URL,
      ),
    ).toThrow(/LOG_LEVEL/);
  });

  it('refuses an inconsistent NODE_ENV / APP_ENV pair', () => {
    expect(() => loadEnv({ ...VALID, NODE_ENV: 'production', APP_ENV: 'local' }, noSecretFile)).toThrow(
      /NODE_ENV/,
    );
  });

  it('requires APP_ORIGIN to be a bare origin, in https once deployed', () => {
    expect(() => loadEnv({ ...VALID, APP_ORIGIN: 'http://localhost:5173/app' }, noSecretFile)).toThrow(
      /APP_ORIGIN/,
    );
    const { DATABASE_URL: _plain, RATE_LIMIT_HMAC_KEY: _key, ...rest } = VALID;
    expect(() =>
      loadEnv(
        {
          ...rest,
          NODE_ENV: 'production',
          APP_ENV: 'production',
          DATABASE_URL_FILE: '/x',
          RATE_LIMIT_HMAC_KEY_FILE: '/run/secrets/rate_limit_hmac_key',
        },
        () => VALID.DATABASE_URL,
      ),
    ).toThrow(/APP_ORIGIN/);
  });

  it('defaults the mail transport to the local Mailpit SMTP server', () => {
    const env = loadEnv(VALID, noSecretFile);
    expect(env.MAIL_DRIVER).toBe('smtp');
    expect(env.SMTP_HOST).toBe('127.0.0.1');
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.MAIL_FROM).toBe(VALID.MAIL_FROM);
  });

  it('requires MAIL_FROM and refuses line breaks in it (header injection)', () => {
    const { MAIL_FROM: _omitted, ...withoutFrom } = VALID;
    expect(() => loadEnv(withoutFrom, noSecretFile)).toThrow(/MAIL_FROM/);
    expect(() => loadEnv({ ...VALID, MAIL_FROM: 'ORBIT <a@b.test>\r\nBcc: x@y.test' }, noSecretFile)).toThrow(
      /MAIL_FROM/,
    );
  });

  it('refuses an unknown mail driver and an invalid SMTP port', () => {
    expect(() => loadEnv({ ...VALID, MAIL_DRIVER: 'sendmail' }, noSecretFile)).toThrow(/MAIL_DRIVER/);
    expect(() => loadEnv({ ...VALID, SMTP_PORT: '70000' }, noSecretFile)).toThrow(/SMTP_PORT/);
  });

  it('defaults registration to the allowlist mode with production hashing costs (ADR-026, ADR-006)', () => {
    const env = loadEnv(VALID, noSecretFile);
    expect(env.REGISTRATION_MODE).toBe('allowlist');
    expect(env.REGISTRATION_ALLOWLIST).toEqual([]);
    expect(env.ARGON2_MEMORY_KIB).toBe(65_536);
    expect(env.ARGON2_ITERATIONS).toBe(3);
    expect(env.AUTH_UNIFORM_RESPONSE_MS).toBe(750);
  });

  it('normalises the allowlist and rejects an invalid address in it', () => {
    const env = loadEnv(
      { ...VALID, REGISTRATION_ALLOWLIST: ' Abdou@Example.TEST, ,aminata@example.test ' },
      noSecretFile,
    );
    expect(env.REGISTRATION_ALLOWLIST).toEqual(['abdou@example.test', 'aminata@example.test']);
    expect(() => loadEnv({ ...VALID, REGISTRATION_ALLOWLIST: 'not-an-email' }, noSecretFile)).toThrow(
      /REGISTRATION_ALLOWLIST/,
    );
    expect(() => loadEnv({ ...VALID, REGISTRATION_MODE: 'public' }, noSecretFile)).toThrow(
      /REGISTRATION_MODE/,
    );
  });

  it('refuses test-only hashing costs and a disabled response floor once deployed', () => {
    const deployed = { ...DEPLOYED, APP_ENV: 'production' };

    expect(() => loadEnv(deployed, deployedSecrets)).not.toThrow();
    expect(() => loadEnv({ ...deployed, ARGON2_MEMORY_KIB: '1024' }, deployedSecrets)).toThrow(
      /ARGON2_MEMORY_KIB/,
    );
    expect(() => loadEnv({ ...deployed, AUTH_UNIFORM_RESPONSE_MS: '0' }, deployedSecrets)).toThrow(
      /AUTH_UNIFORM_RESPONSE_MS/,
    );
  });

  it('requires the rate limit HMAC key and keeps abuse protections on once deployed', () => {
    const { RATE_LIMIT_HMAC_KEY: _omitted, ...withoutKey } = VALID;
    expect(() => loadEnv(withoutKey, noSecretFile)).toThrow(/RATE_LIMIT_HMAC_KEY/);
    expect(() => loadEnv({ ...VALID, RATE_LIMIT_HMAC_KEY: 'too-short' }, noSecretFile)).toThrow(
      /RATE_LIMIT_HMAC_KEY/,
    );
    expect(loadEnv({ ...VALID, RATE_LIMIT_ENABLED: 'false' }, noSecretFile).RATE_LIMIT_ENABLED).toBe(false);
    const { DATABASE_URL: _plain, RATE_LIMIT_HMAC_KEY: _key, ...rest } = VALID;
    const deployed = {
      ...rest,
      NODE_ENV: 'production',
      APP_ENV: 'production',
      APP_ORIGIN: 'https://orbit.example.com',
      DATABASE_URL_FILE: '/run/secrets/database_url',
      RATE_LIMIT_HMAC_KEY_FILE: '/run/secrets/rate_limit_hmac_key',
      RATE_LIMIT_ENABLED: 'false',
    };
    expect(() => loadEnv(deployed, () => VALID.DATABASE_URL)).toThrow(/RATE_LIMIT_ENABLED/);
  });

  it('reports an unreadable secret file without leaking its content', () => {
    const { DATABASE_URL: _plain, RATE_LIMIT_HMAC_KEY: _key, ...rest } = VALID;
    expect(() =>
      loadEnv(
        {
          ...rest,
          DATABASE_URL_FILE: '/missing',
          RATE_LIMIT_HMAC_KEY_FILE: '/run/secrets/rate_limit_hmac_key',
        },
        () => {
          throw new Error('ENOENT: /missing');
        },
      ),
    ).toThrow(ConfigurationError);
  });
});
