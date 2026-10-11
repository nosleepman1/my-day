import { Writable } from 'node:stream';

import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { REDACT_CENSOR, REDACT_PATHS } from './redaction';

function captureLogger(): { logger: pino.Logger; output: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  const logger = pino({ redact: { paths: [...REDACT_PATHS], censor: REDACT_CENSOR } }, stream);
  return { logger, output: () => chunks.join('') };
}

describe('log redaction (CODING_STANDARDS §7)', () => {
  it('never writes passwords, tokens, cookies or authorization headers', () => {
    const { logger, output } = captureLogger();
    logger.info(
      {
        body: { password: 'fake-password-123', token: 'fake-token-456', email: 'someone@example.test' },
        req: { headers: { authorization: 'Bearer fake-bearer-789', cookie: '__Host-orbit_sid=fake-sid' } },
      },
      'request.received',
    );
    const written = output();
    for (const secret of [
      'fake-password-123',
      'fake-token-456',
      'fake-bearer-789',
      'fake-sid',
      'someone@example.test',
    ]) {
      expect(written).not.toContain(secret);
    }
    expect(written).toContain(REDACT_CENSOR);
  });
});
