import { http as mswHttp, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { server } from '@/test/msw-server';

import { ApiError, http, NetworkError } from './client';

const StatusSchema = z.object({ data: z.object({ status: z.literal('ok') }) });

describe('http client (FRONTEND.md §3)', () => {
  it('calls the same-origin API with credentials and the anti-CSRF header, then validates the body', async () => {
    let seen: Request | undefined;
    server.use(
      mswHttp.get('/api/v1/health/live', ({ request }) => {
        seen = request;
        return HttpResponse.json({ data: { status: 'ok' } });
      }),
    );

    await expect(http('/health/live', StatusSchema)).resolves.toEqual({ data: { status: 'ok' } });
    expect(seen?.headers.get('X-Requested-With')).toBe('orbit');
    expect(seen?.credentials).toBe('include');
  });

  it('turns the error envelope into an ApiError carrying the stable code', async () => {
    server.use(
      mswHttp.get('/api/v1/health/ready', () =>
        HttpResponse.json(
          { error: { code: 'SERVICE_UNAVAILABLE', message: 'Indisponible', requestId: 'req-1' } },
          { status: 503 },
        ),
      ),
    );

    const error = await http('/health/ready', StatusSchema).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, code: 'SERVICE_UNAVAILABLE', requestId: 'req-1' });
  });

  it('reports an unexpected error body as UNKNOWN', async () => {
    server.use(mswHttp.get('/api/v1/broken', () => new HttpResponse('oops', { status: 502 })));

    await expect(http('/broken', StatusSchema)).rejects.toMatchObject({ status: 502, code: 'UNKNOWN' });
  });

  it('sends a JSON body and the Idempotency-Key when provided', async () => {
    let body: unknown;
    let key: string | null = null;
    server.use(
      mswHttp.post('/api/v1/echo', async ({ request }) => {
        body = await request.json();
        key = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ data: { status: 'ok' } });
      }),
    );

    await http('/echo', StatusSchema, {
      method: 'POST',
      body: { amountMinor: '150000' },
      idempotencyKey: 'k-1',
    });
    expect(body).toEqual({ amountMinor: '150000' });
    expect(key).toBe('k-1');
  });

  it('wraps network failures in NetworkError', async () => {
    server.use(mswHttp.get('/api/v1/offline', () => HttpResponse.error()));

    await expect(http('/offline', StatusSchema)).rejects.toBeInstanceOf(NetworkError);
  });
});
