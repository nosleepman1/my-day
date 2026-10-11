import { describe, expect, it } from 'vitest';

import { ConfigurationError, loadEnv } from './env.schema';

const VALID = {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  APP_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://orbit_app:fake-password@localhost:5432/orbit',
} as const;

const noSecretFile = (): string => {
  throw new Error('no secret file expected');
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
    const { DATABASE_URL: _plain, ...rest } = VALID;
    const env = loadEnv(
      {
        ...rest,
        NODE_ENV: 'production',
        APP_ENV: 'staging',
        APP_ORIGIN: 'https://orbit.example.com',
        DATABASE_URL_FILE: '/run/secrets/database_url',
      },
      (path) => (path === '/run/secrets/database_url' ? 'postgresql://orbit_app:fake@db:5432/orbit\n' : ''),
    );
    expect(env.DATABASE_URL).toBe('postgresql://orbit_app:fake@db:5432/orbit');
  });

  it('refuses the trace log level outside local and test', () => {
    const { DATABASE_URL: _plain, ...rest } = VALID;
    expect(() =>
      loadEnv(
        {
          ...rest,
          APP_ENV: 'production',
          NODE_ENV: 'production',
          LOG_LEVEL: 'trace',
          DATABASE_URL_FILE: '/x',
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
    const { DATABASE_URL: _plain, ...rest } = VALID;
    expect(() =>
      loadEnv(
        { ...rest, NODE_ENV: 'production', APP_ENV: 'production', DATABASE_URL_FILE: '/x' },
        () => VALID.DATABASE_URL,
      ),
    ).toThrow(/APP_ORIGIN/);
  });

  it('reports an unreadable secret file without leaking its content', () => {
    const { DATABASE_URL: _plain, ...rest } = VALID;
    expect(() =>
      loadEnv({ ...rest, DATABASE_URL_FILE: '/missing' }, () => {
        throw new Error('ENOENT: /missing');
      }),
    ).toThrow(ConfigurationError);
  });
});
