import { describe, expect, it } from 'vitest';

import { uuidv7 } from './ids';

describe('uuidv7 utility', () => {
  it('generates valid UUIDv7 strings with default and custom timestamps', () => {
    const idDefault = uuidv7();
    expect(idDefault).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    const t1 = Date.parse('2026-10-15T00:00:00.000Z');
    const t2 = Date.parse('2026-10-15T00:00:01.000Z');
    const id1 = uuidv7(t1);
    const id2 = uuidv7(t2);

    expect(id1 < id2).toBe(true);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(id2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
