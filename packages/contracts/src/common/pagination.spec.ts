import { describe, expect, it } from 'vitest';

import { PaginationQuerySchema } from './pagination';

describe('PaginationQuerySchema (API.md §7)', () => {
  it('defaults the limit to 25', () => {
    expect(PaginationQuerySchema.parse({})).toEqual({ limit: 25 });
  });

  it('coerces the query string and keeps the cursor', () => {
    expect(PaginationQuerySchema.parse({ limit: '50', cursor: 'abc' })).toEqual({ limit: 50, cursor: 'abc' });
  });

  it.each(['0', '101', '2.5', 'x'])('rejects limit=%j', (limit) => {
    expect(PaginationQuerySchema.safeParse({ limit }).success).toBe(false);
  });
});
