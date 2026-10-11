import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from '../../helpers/create-test-app';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('health and HTTP platform (PHASE-00)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health/live answers ok without internal details', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    expect(response.body).toEqual({ data: { status: 'ok' } });
    expect(response.headers['x-request-id']).toMatch(UUID_V7);
  });

  it('GET /api/v1/health/ready answers ok when PostgreSQL responds', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    expect(response.body).toEqual({ data: { status: 'ok' } });
  });

  function expectSecurityHeaders(headers: Record<string, string | undefined>): void {
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toContain("default-src 'none'");
    expect(headers['content-security-policy']).toContain('sandbox');
    expect(headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
    expect(headers['cache-control']).toBe('no-store');
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['x-request-id']).toMatch(UUID_V7);
    expect(headers['x-powered-by']).toBeUndefined();
  }

  it('sets security headers and hides the framework (SECURITY.md §3.10)', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/live');
    expectSecurityHeaders(response.headers);
  });

  it('echoes a well-formed incoming X-Request-Id', async () => {
    const requestId = '0192f1c3-7a2b-7c1e-9d0f-3b4c5d6e7f80';
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('X-Request-Id', requestId);
    expect(response.headers['x-request-id']).toBe(requestId);
  });

  it('answers unknown routes with the NOT_FOUND envelope', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String), requestId: response.headers['x-request-id'] },
    });
  });

  it('answers malformed JSON with INVALID_JSON', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/health/live')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
    expectSecurityHeaders(response.headers);
  });

  it('refuses JSON bodies above 1 MB with PAYLOAD_TOO_LARGE (API.md §11)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/health/live')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(1_100_000) }));
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
    expectSecurityHeaders(response.headers);
  });
});

describe('readiness without database', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({
      DATABASE_URL: 'postgresql://orbit_app:fake@127.0.0.1:1/orbit?connect_timeout=1',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health/ready answers 503 SERVICE_UNAVAILABLE when PostgreSQL is unreachable', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503);
    expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
    expect(JSON.stringify(response.body)).not.toMatch(/127\.0\.0\.1|orbit_app|ECONNREFUSED/);
  });
});
