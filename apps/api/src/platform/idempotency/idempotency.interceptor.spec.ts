import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainError } from '../errors/domain-error';
import type { TenantContext } from '../tenant/tenant-context';

import { IdempotencyInterceptor } from './idempotency.interceptor';
import type { IdempotencyService } from './idempotency.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const KEY_1 = '01927000-0000-7000-8000-000000000002';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let mockReflector: Reflector;
  let mockService: {
    start: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    abort: ReturnType<typeof vi.fn>;
  };
  let mockTenant: TenantContext;
  let mockContext: ExecutionContext;
  let mockHandler: CallHandler;
  let mockRequest: {
    method: string;
    path: string;
    route?: { path: string };
    headers: Record<string, string | undefined>;
    body: unknown;
  };
  let mockResponse: {
    statusCode: number;
    setHeader: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockReflector = new Reflector();
    vi.spyOn(mockReflector, 'get').mockReturnValue({ required: true });

    mockService = {
      start: vi.fn().mockResolvedValue({ status: 'STARTED' }),
      complete: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
    };

    mockTenant = {
      requireUserId: vi.fn().mockReturnValue(USER_1),
    } as unknown as TenantContext;

    mockRequest = {
      method: 'POST',
      path: '/api/v1/finance/transactions',
      route: { path: '/api/v1/finance/transactions' },
      headers: { 'idempotency-key': KEY_1 },
      body: { amountMinor: '1000' },
    };

    mockResponse = {
      statusCode: 201,
      setHeader: vi.fn(),
      status: vi.fn(),
    };

    mockContext = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    mockHandler = {
      handle: vi.fn().mockReturnValue(of({ data: { id: 'tx-1' } })),
    };

    interceptor = new IdempotencyInterceptor(
      mockReflector,
      mockService as unknown as IdempotencyService,
      mockTenant,
    );
  });

  it('bypasses interceptor if endpoint is not marked with @Idempotent', async () => {
    vi.spyOn(mockReflector, 'get').mockReturnValue(undefined);

    const stream$ = await interceptor.intercept(mockContext, mockHandler);
    const result = await lastValueFrom(stream$);

    expect(result).toEqual({ data: { id: 'tx-1' } });
    expect(mockService.start).not.toHaveBeenCalled();
  });

  it('throws IDEMPOTENCY_KEY_REQUIRED if required key is missing', async () => {
    mockRequest.headers = {};

    await expect(interceptor.intercept(mockContext, mockHandler)).rejects.toThrow(DomainError);
  });

  it('completes idempotency record on successful handler completion', async () => {
    const stream$ = await interceptor.intercept(mockContext, mockHandler);
    const result = await lastValueFrom(stream$);

    expect(result).toEqual({ data: { id: 'tx-1' } });
    expect(mockService.complete).toHaveBeenCalledWith({
      userId: USER_1,
      scope: 'POST /api/v1/finance/transactions',
      key: KEY_1,
      responseStatus: 201,
      responseBody: { data: { id: 'tx-1' } },
    });
  });

  it('replays response with Idempotent-Replayed header when status is REPLAYED', async () => {
    mockService.start.mockResolvedValue({
      status: 'REPLAYED',
      responseStatus: 201,
      responseBody: { data: { id: 'tx-1-cached' } },
    });

    const stream$ = await interceptor.intercept(mockContext, mockHandler);
    const result = await lastValueFrom(stream$);

    expect(mockResponse.setHeader).toHaveBeenCalledWith('Idempotent-Replayed', 'true');
    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(result).toEqual({ data: { id: 'tx-1-cached' } });
    expect(mockHandler.handle).not.toHaveBeenCalled();
  });

  it('aborts on unhandled 5xx error', async () => {
    mockHandler.handle = vi.fn().mockReturnValue(throwError(() => new Error('DB Crash')));

    const stream$ = await interceptor.intercept(mockContext, mockHandler);
    await expect(lastValueFrom(stream$)).rejects.toThrow('DB Crash');
    expect(mockService.abort).toHaveBeenCalledWith(USER_1, 'POST /api/v1/finance/transactions', KEY_1);
  });
});
