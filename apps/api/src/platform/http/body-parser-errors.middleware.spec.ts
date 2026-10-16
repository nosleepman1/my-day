import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../errors/domain-error';

import { translateBodyParserErrors } from './body-parser-errors.middleware';

describe('translateBodyParserErrors', () => {
  const req = {} as Request;
  const res = {} as Response;

  it('passes unmapped error straight to next', () => {
    const error = new Error('Random error');
    const next = vi.fn();

    translateBodyParserErrors(error, req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });

  it('translates JSON syntax error into DomainError INVALID_JSON', () => {
    const error = { type: 'entity.parse.failed' };
    const next = vi.fn();

    translateBodyParserErrors(error, req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(DomainError));
    const arg = next.mock.calls[0]?.[0] as DomainError;
    expect(arg.code).toBe('INVALID_JSON');
  });

  it('translates payload too large error into DomainError PAYLOAD_TOO_LARGE', () => {
    const error = { type: 'entity.too.large' };
    const next = vi.fn();

    translateBodyParserErrors(error, req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(DomainError));
    const arg = next.mock.calls[0]?.[0] as DomainError;
    expect(arg.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
