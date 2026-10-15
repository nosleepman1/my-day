import { describe, expect, it } from 'vitest';

import { DomainError } from '../../../platform/errors/domain-error';
import { encodeCursor } from '../../../platform/http/cursor';

import { cursorWhere, defineSort, keysetPage, orderByOf } from './keyset';

const ID = '0192f1c3-7a2b-7c1e-9d0f-3b4c5d6e7f81';
const LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

describe('keyset pagination (API.md §7)', () => {
  const due = defineSort('dueDate', 'date', { nullable: true });
  const priority = defineSort('-priority', 'enum', { nullable: true, enumValues: LEVELS });
  const created = defineSort('-createdAt', 'instant');
  const title = defineSort('title', 'text', { nullable: true });

  it('orders by the field then id, nulls last for nullable fields', () => {
    expect(orderByOf(due)).toEqual([{ dueDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }]);
    expect(orderByOf(created)).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('round-trips a cursor through a page and back into a filter', () => {
    const rows = [
      { id: ID, dueDate: new Date('2026-10-14T00:00:00Z') },
      { id: ID, dueDate: null },
    ];
    const page = keysetPage(rows, 1, due);
    expect(page.hasMore).toBe(true);
    expect(cursorWhere(due, page.nextCursor ?? undefined)).toEqual({
      OR: [
        { dueDate: { gt: new Date('2026-10-14T00:00:00Z') } },
        { dueDate: new Date('2026-10-14T00:00:00Z'), id: { gt: ID } },
        { dueDate: null },
      ],
    });
  });

  it('continues inside the null tail after a null value', () => {
    const page = keysetPage(
      [
        { id: ID, title: null },
        { id: ID, title: null },
      ],
      1,
      title,
    );
    expect(cursorWhere(title, page.nextCursor ?? undefined)).toEqual({ title: null, id: { gt: ID } });
  });

  it('compares enumerations by their declared order', () => {
    const cursor = encodeCursor(['-priority', '0', 'MEDIUM', ID]);
    expect(cursorWhere(priority, cursor)).toEqual({
      OR: [{ priority: { in: ['LOW'] } }, { priority: 'MEDIUM', id: { lt: ID } }, { priority: null }],
    });
  });

  it('returns no cursor on the last page and no filter without a cursor', () => {
    expect(keysetPage([{ id: ID, title: 'a' }], 5, title).nextCursor).toBeNull();
    expect(cursorWhere(title, undefined)).toEqual({});
  });

  it.each([
    ['another sort key', encodeCursor(['title', '0', 'x', ID]), due],
    ['a bad id', encodeCursor(['dueDate', '0', '2026-10-14', 'nope']), due],
    ['a bad flag', encodeCursor(['dueDate', '2', '2026-10-14', ID]), due],
    ['a bad date', encodeCursor(['dueDate', '0', 'pas une date', ID]), due],
    ['an unknown enum value', encodeCursor(['-priority', '0', 'NOW', ID]), priority],
    ['a null on a required field', encodeCursor(['-createdAt', '1', '', ID]), created],
  ])('rejects a cursor with %s', (_label, cursor, spec) => {
    expect(() => cursorWhere(spec, cursor)).toThrow(DomainError);
  });
});
