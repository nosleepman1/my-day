import { describe, expect, it } from 'vitest';

import { DomainError } from '../errors/domain-error';

import { decodeCursor, encodeCursor } from './cursor';

describe('pagination cursor (API.md §7)', () => {
  it('round-trips its parts and stays URL-safe', () => {
    const cursor = encodeCursor(['2026-10-13T09:30:00.000Z', '01928f4e-8c2a-7b3d-9e4f-0123456789ab']);

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor, 2)).toEqual([
      '2026-10-13T09:30:00.000Z',
      '01928f4e-8c2a-7b3d-9e4f-0123456789ab',
    ]);
  });

  it.each([
    ['garbage', 'not*a*cursor'],
    ['the wrong arity', encodeCursor(['only-one'])],
    ['non-string parts', Buffer.from('[1,2]').toString('base64url')],
    ['an object', Buffer.from('{"a":"b"}').toString('base64url')],
  ])('refuses %s with INVALID_CURSOR', (_label, cursor) => {
    const error: unknown = (() => {
      try {
        return decodeCursor(cursor, 2);
      } catch (caught: unknown) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('INVALID_CURSOR');
  });
});
