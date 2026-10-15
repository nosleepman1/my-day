import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../database/prisma.service';
import { DomainError } from '../errors/domain-error';
import type { IdGeneratorPort } from '../ids/id-generator.port';
import type { ClockPort } from '../time/clock.port';

import { canonicalJsonHash } from './canonical-json';
import { IdempotencyService } from './idempotency.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const KEY_1 = '01927000-0000-7000-8000-000000000002';
const SCOPE = 'POST /api/v1/finance/transactions';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let mockPrisma: {
    idempotencyKey: {
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };
  let mockIds: IdGeneratorPort;
  let mockClock: ClockPort;

  const now = new Date('2026-01-01T00:00:00.000Z');
  const validHash = canonicalJsonHash({ amountMinor: '1000' });

  beforeEach(() => {
    mockPrisma = {
      idempotencyKey: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'key-id' }),
        update: vi.fn().mockResolvedValue({ id: 'key-id' }),
        delete: vi.fn().mockResolvedValue({ id: 'key-id' }),
      },
    };

    mockIds = {
      next: vi.fn().mockReturnValue('gen-id-123'),
    };

    mockClock = {
      now: vi.fn().mockReturnValue(now),
    };

    service = new IdempotencyService(mockPrisma as unknown as PrismaService, mockIds, mockClock);
  });

  describe('validateKey', () => {
    it('accepts valid alphanumeric and hyphen/underscore keys between 16 and 128 chars', () => {
      expect(() => {
        service.validateKey('01927000-0000-7000-8000-000000000002');
      }).not.toThrow();
      expect(() => {
        service.validateKey('custom_key_123456789');
      }).not.toThrow();
    });

    it('rejects keys that are too short or contain invalid characters', () => {
      expect(() => {
        service.validateKey('short');
      }).toThrow(DomainError);
      expect(() => {
        service.validateKey('key with spaces and special chars!!!!');
      }).toThrow(DomainError);
    });
  });

  describe('start', () => {
    it('creates new IN_PROGRESS key when key is first seen', async () => {
      const res = await service.start({
        userId: USER_1,
        scope: SCOPE,
        key: KEY_1,
        requestHash: validHash,
      });

      expect(res.status).toBe('STARTED');
      expect(mockPrisma.idempotencyKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: USER_1,
          scope: SCOPE,
          key: KEY_1,
          status: 'IN_PROGRESS',
        }),
      });
    });

    it('throws IDEMPOTENCY_IN_PROGRESS when request is currently being processed', async () => {
      mockPrisma.idempotencyKey.findFirst.mockResolvedValue({
        userId: USER_1,
        scope: SCOPE,
        key: KEY_1,
        status: 'IN_PROGRESS',
        expiresAt: new Date('2026-01-08T00:00:00.000Z'),
      });

      await expect(
        service.start({
          userId: USER_1,
          scope: SCOPE,
          key: KEY_1,
          requestHash: validHash,
        }),
      ).rejects.toThrow(DomainError);
    });

    it('replays response when same request was already completed', async () => {
      mockPrisma.idempotencyKey.findFirst.mockResolvedValue({
        userId: USER_1,
        scope: SCOPE,
        key: KEY_1,
        requestHash: validHash,
        status: 'COMPLETED',
        responseStatus: 201,
        responseBody: { data: { id: 'tx-1' } },
        expiresAt: new Date('2026-01-08T00:00:00.000Z'),
      });

      const res = await service.start({
        userId: USER_1,
        scope: SCOPE,
        key: KEY_1,
        requestHash: validHash,
      });

      expect(res.status).toBe('REPLAYED');
      if (res.status === 'REPLAYED') {
        expect(res.responseStatus).toBe(201);
        expect(res.responseBody).toEqual({ data: { id: 'tx-1' } });
      }
    });

    it('throws IDEMPOTENCY_REPLAY when key is reused with different request payload', async () => {
      const differentHash = canonicalJsonHash({ amountMinor: '9999' });
      mockPrisma.idempotencyKey.findFirst.mockResolvedValue({
        userId: USER_1,
        scope: SCOPE,
        key: KEY_1,
        requestHash: validHash,
        status: 'COMPLETED',
        responseStatus: 201,
        responseBody: { data: { id: 'tx-1' } },
        expiresAt: new Date('2026-01-08T00:00:00.000Z'),
      });

      await expect(
        service.start({
          userId: USER_1,
          scope: SCOPE,
          key: KEY_1,
          requestHash: differentHash,
        }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('complete and abort', () => {
    it('completes idempotency record on successful response', async () => {
      await service.complete({
        userId: USER_1,
        scope: SCOPE,
        key: KEY_1,
        responseStatus: 201,
        responseBody: { data: { id: 'tx-1' } },
      });

      expect(mockPrisma.idempotencyKey.update).toHaveBeenCalledWith({
        where: {
          userId_scope_key: { userId: USER_1, scope: SCOPE, key: KEY_1 },
        },
        data: expect.objectContaining({
          status: 'COMPLETED',
          responseStatus: 201,
        }),
      });
    });

    it('aborts and deletes in-progress key on 5xx or unhandled error', async () => {
      await service.abort(USER_1, SCOPE, KEY_1);
      expect(mockPrisma.idempotencyKey.delete).toHaveBeenCalledWith({
        where: {
          userId_scope_key: { userId: USER_1, scope: SCOPE, key: KEY_1 },
        },
      });
    });
  });
});
