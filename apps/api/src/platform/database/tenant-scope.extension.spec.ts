import { describe, expect, it } from 'vitest';

import { assertScopedModel, scopeArgs, TenantScopeViolationError } from './tenant-scope.extension';

const USER = '01928f4e-8c2a-7b3d-9e4f-0123456789ab';
const OTHER = '01928f4e-8c2a-7b3d-9e4f-ba9876543210';

describe('scopeArgs (ADR-007-3)', () => {
  it.each([
    'findFirst',
    'findFirstOrThrow',
    'findMany',
    'count',
    'aggregate',
    'groupBy',
    'update',
    'updateMany',
    'updateManyAndReturn',
    'delete',
    'deleteMany',
  ])('adds userId to the where clause of %s', (operation) => {
    expect(scopeArgs(operation, { where: { status: 'OPEN' } }, USER)).toMatchObject({
      where: { status: 'OPEN', userId: USER },
    });
  });

  it('scopes a query without any where clause', () => {
    expect(scopeArgs('findMany', {}, USER)).toEqual({ where: { userId: USER } });
  });

  it("combines a caller-supplied userId with the context: another user's rows are never matched", () => {
    expect(scopeArgs('findMany', { where: { userId: OTHER } }, USER)).toEqual({
      where: { AND: [{ userId: OTHER }, { userId: USER }] },
    });
    expect(scopeArgs('findMany', { where: { userId: USER } }, USER)).toEqual({ where: { userId: USER } });
  });

  it('adds userId to created rows', () => {
    expect(scopeArgs('create', { data: { title: 'Idée' } }, USER)).toEqual({
      data: { title: 'Idée', userId: USER },
    });
    expect(scopeArgs('createMany', { data: [{ title: 'a' }, { title: 'b' }] }, USER)).toEqual({
      data: [
        { title: 'a', userId: USER },
        { title: 'b', userId: USER },
      ],
    });
    expect(scopeArgs('createManyAndReturn', { data: { title: 'a' } }, USER)).toEqual({
      data: { title: 'a', userId: USER },
    });
  });

  it('scopes both sides of an upsert', () => {
    expect(
      scopeArgs('upsert', { where: { id: 'x' }, create: { title: 'a' }, update: { title: 'b' } }, USER),
    ).toEqual({
      where: { id: 'x', userId: USER },
      create: { title: 'a', userId: USER },
      update: { title: 'b' },
    });
  });

  it.each([
    ['create for another user', 'create', { data: { userId: OTHER } }],
    ['createMany for another user', 'createMany', { data: [{ userId: OTHER }] }],
    ['update moving a row', 'update', { where: { id: 'x' }, data: { userId: OTHER } }],
    ["update targeting another user's row", 'update', { where: { id: 'x', userId: OTHER }, data: {} }],
    ["delete targeting another user's row", 'delete', { where: { id: 'x', userId: OTHER } }],
    ['updateMany moving rows', 'updateMany', { data: { userId: USER } }],
    ['upsert moving a row', 'upsert', { where: { id: 'x' }, create: {}, update: { userId: OTHER } }],
    ['findUnique', 'findUnique', { where: { id: 'x' } }],
    ['findUniqueOrThrow', 'findUniqueOrThrow', { where: { id: 'x' } }],
    ['an unknown operation', 'aggregateRaw', {}],
  ])('refuses %s', (_label, operation, args) => {
    expect(() => scopeArgs(operation, args, USER)).toThrow(TenantScopeViolationError);
  });

  it('never mutates the arguments it receives', () => {
    const args = { where: { status: 'OPEN' } };

    scopeArgs('findMany', args, USER);

    expect(args).toEqual({ where: { status: 'OPEN' } });
  });
});

describe('assertScopedModel', () => {
  it.each(['User', 'Session', 'EmailVerificationToken', 'PasswordResetToken'])(
    'refuses the unscoped model %s through the tenant client',
    (model) => {
      expect(() => {
        assertScopedModel(model);
      }).toThrow(TenantScopeViolationError);
    },
  );

  it('accepts a tenant model', () => {
    expect(() => {
      assertScopedModel('UserPreference');
    }).not.toThrow();
  });
});
