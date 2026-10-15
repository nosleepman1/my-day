import { createHmac } from 'node:crypto';

const MIN_KEY_LENGTH = 32;

/**
 * Pseudonymisation par HMAC-SHA256 (`RATE_LIMIT_HMAC_KEY`, SECURITY.md §3.7) : les compteurs anti-abus et
 * `login_events.email_hmac` ne contiennent jamais d'IP ni d'adresse e-mail en clair.
 */
export class Pseudonymizer {
  constructor(private readonly key: string) {
    if (key.length < MIN_KEY_LENGTH) {
      throw new Error(`RATE_LIMIT_HMAC_KEY must contain at least ${MIN_KEY_LENGTH} characters`);
    }
  }

  digest(value: string): Buffer {
    return createHmac('sha256', this.key).update(value, 'utf8').digest();
  }

  hex(value: string): string {
    return this.digest(value).toString('hex');
  }
}
