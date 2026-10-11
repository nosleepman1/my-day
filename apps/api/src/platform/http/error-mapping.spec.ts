import { HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ZodValidationException } from 'nestjs-zod';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { DomainError } from '../errors/domain-error';

import { toApiError } from './error-mapping';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('db failure', { code, clientVersion: 'test' });
}

describe('toApiError (API.md §5)', () => {
  it('keeps the code, message and details of a DomainError', () => {
    const error = new DomainError('INSUFFICIENT_FUNDS', 'Solde insuffisant.', { accountId: 'a1' });
    expect(toApiError(error)).toEqual({
      status: 422,
      code: 'INSUFFICIENT_FUNDS',
      message: 'Solde insuffisant.',
      details: { accountId: 'a1' },
    });
  });

  it('maps a Zod validation failure to VALIDATION_FAILED with field details', () => {
    const result = z.object({ amountMinor: z.string() }).safeParse({ amountMinor: 12 });
    if (result.success) throw new Error('expected a validation failure');
    const mapped = toApiError(new ZodValidationException(result.error));
    expect(mapped.status).toBe(400);
    expect(mapped.code).toBe('VALIDATION_FAILED');
    expect(mapped.details).toEqual([expect.objectContaining({ path: ['amountMinor'] })]);
  });

  it.each([
    [new NotFoundException(), 404, 'NOT_FOUND'],
    [new HttpException('x', 405), 405, 'METHOD_NOT_ALLOWED'],
    [new HttpException('x', 413), 413, 'PAYLOAD_TOO_LARGE'],
    [new HttpException('x', 415), 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [new HttpException('x', 429), 429, 'RATE_LIMITED'],
    [new HttpException('x', 403), 404, 'NOT_FOUND'],
    [new HttpException('x', 409), 409, 'CONFLICT'],
    [new HttpException('x', 422), 422, 'BUSINESS_RULE_VIOLATION'],
    [new HttpException('x', 503), 503, 'SERVICE_UNAVAILABLE'],
    [new HttpException('x', 401), 401, 'UNAUTHENTICATED'],
    [new HttpException('x', 418), 500, 'INTERNAL_ERROR'],
  ])('maps the framework exception %o', (exception, status, code) => {
    expect(toApiError(exception)).toMatchObject({ status, code });
  });

  it('maps body-parser failures', () => {
    expect(
      toApiError(Object.assign(new SyntaxError('bad'), { type: 'entity.parse.failed', status: 400 })),
    ).toMatchObject({ status: 400, code: 'INVALID_JSON' });
    expect(
      toApiError(Object.assign(new Error('big'), { type: 'entity.too.large', status: 413 })),
    ).toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
  });

  it.each([
    ['P2002', 409, 'CONFLICT'],
    ['P2003', 404, 'NOT_FOUND'],
    ['P2025', 404, 'NOT_FOUND'],
    ['P2024', 503, 'SERVICE_UNAVAILABLE'],
    ['P2034', 500, 'INTERNAL_ERROR'],
  ])('maps the Prisma error %s (API.md §5.3)', (code, status, apiCode) => {
    expect(toApiError(prismaError(code))).toMatchObject({ status, code: apiCode });
  });

  it('maps an unreachable database to SERVICE_UNAVAILABLE', () => {
    const error = new Prisma.PrismaClientInitializationError("Can't reach database server", 'test');
    expect(toApiError(error)).toMatchObject({ status: 503, code: 'SERVICE_UNAVAILABLE' });
  });

  it('hides unexpected errors behind INTERNAL_ERROR without leaking the message', () => {
    const mapped = toApiError(new Error('relation "users" does not exist'));
    expect(mapped).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
    expect(mapped.message).not.toContain('users');
  });
});
