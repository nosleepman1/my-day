import { describe, expect, it } from 'vitest';

import { sanitizeAuditMetadata } from './audit.service';

describe('sanitizeAuditMetadata (DATA_MODEL.md, audit_logs)', () => {
  it('keeps scalar values and drops anything that looks like a secret', () => {
    expect(
      sanitizeAuditMetadata({
        code: 'INVALID_CREDENTIALS',
        attempts: 3,
        locked: false,
        previous: null,
        password: 'x',
        newPasswordHash: 'y',
        resetToken: 'z',
        apiKey: 'k',
        Cookie: 'c',
      }),
    ).toEqual({ code: 'INVALID_CREDENTIALS', attempts: 3, locked: false, previous: null });
  });

  it('drops nested values, truncates long strings and caps the number of keys', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`field${index}`, index]));

    expect(sanitizeAuditMetadata({ nested: { a: 1 }, list: [1] })).toEqual({});
    expect(sanitizeAuditMetadata({ note: 'n'.repeat(500) })['note']).toHaveLength(200);
    expect(Object.keys(sanitizeAuditMetadata(many))).toHaveLength(20);
  });
});
