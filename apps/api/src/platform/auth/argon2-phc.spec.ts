import { describe, expect, it } from 'vitest';

import { formatArgon2idPhc, parseArgon2idPhc } from './argon2-phc';

const SALT = Buffer.from('0123456789abcdef', 'utf8');
const DIGEST = Buffer.alloc(32, 7);
const PARAMS = { memoryCost: 1024, timeCost: 1, parallelism: 1 };

function unpadded(bytes: Buffer): string {
  return bytes.toString('base64').replace(/=+$/, '');
}

describe('argon2id PHC codec', () => {
  it('formats the PHC string with unpadded standard base64', () => {
    const phc = formatArgon2idPhc(PARAMS, SALT, DIGEST);

    expect(phc).toBe(`$argon2id$v=19$m=1024,t=1,p=1$${unpadded(SALT)}$${unpadded(DIGEST)}`);
  });

  it('round-trips params, salt and digest', () => {
    const parsed = parseArgon2idPhc(formatArgon2idPhc(PARAMS, SALT, DIGEST));

    expect(parsed).toEqual({ params: PARAMS, salt: SALT, digest: DIGEST });
  });

  it.each([
    ['not-a-hash'],
    [''],
    ['$argon2i$v=19$m=1024,t=1,p=1$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaA'],
    ['$argon2id$v=16$m=1024,t=1,p=1$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaA'],
    ['$argon2id$v=19$m=1024,t=1$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaA'],
    ['$argon2id$v=19$m=abc,t=1,p=1$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaA'],
    ['$argon2id$v=19$m=1024,t=1,p=1$c2Fs$aGFzaGhhc2hoYXNoaGFzaA'],
    ['$argon2id$v=19$m=1024,t=1,p=1$c2FsdHNhbHQ$aGFz'],
    ['$argon2id$v=19$m=1024,t=1,p=1$c2Fsd*Nhb$aGFzaGhhc2hoYXNoaGFzaA'],
  ])('rejects malformed or unsupported input %j', (input) => {
    expect(parseArgon2idPhc(input)).toBeNull();
  });

  it('rejects costs outside the accepted bounds (no DoS through a forged stored hash)', () => {
    const tooMuchMemory = formatArgon2idPhc({ ...PARAMS, memoryCost: 4_194_304 }, SALT, DIGEST);
    const tooManyPasses = formatArgon2idPhc({ ...PARAMS, timeCost: 1_000 }, SALT, DIGEST);

    expect(parseArgon2idPhc(tooMuchMemory)).toBeNull();
    expect(parseArgon2idPhc(tooManyPasses)).toBeNull();
  });
});
