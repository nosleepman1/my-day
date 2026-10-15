import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../platform/errors/domain-error';
import type { FinanceContext } from '../shared/finance-context';

import type { CounterpartiesRepository } from './counterparties.repository';
import { CounterpartiesService } from './counterparties.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const CP_1 = '01927000-0000-7000-8000-000000000002';
const CP_2 = '01927000-0000-7000-8000-000000000003';

describe('CounterpartiesService', () => {
  let service: CounterpartiesService;
  let mockRepo: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByName: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    archive: ReturnType<typeof vi.fn>;
    unarchive: ReturnType<typeof vi.fn>;
    countTransactions: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    merge: ReturnType<typeof vi.fn>;
  };
  let mockCtx: {
    userId: ReturnType<typeof vi.fn>;
    newId: ReturnType<typeof vi.fn>;
    now: ReturnType<typeof vi.fn>;
  };

  const sampleCounterparty = {
    id: CP_1,
    userId: USER_1,
    name: 'Boulangerie du Coin',
    kind: 'PERSON' as const,
    phone: '+221770000000',
    email: 'contact@boulangerie.sn',
    notes: 'Fournisseur pain',
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    _count: { transactions: 3 },
  };

  beforeEach(() => {
    mockRepo = {
      create: vi.fn().mockResolvedValue(sampleCounterparty),
      findById: vi.fn().mockResolvedValue(sampleCounterparty),
      findByName: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue({
        rows: [sampleCounterparty],
        hasMore: false,
        nextCursor: null,
      }),
      update: vi.fn().mockResolvedValue({ ...sampleCounterparty, name: 'Boulangerie Modifiée' }),
      archive: vi
        .fn()
        .mockResolvedValue({ ...sampleCounterparty, archivedAt: new Date('2026-02-01T00:00:00.000Z') }),
      unarchive: vi.fn().mockResolvedValue({ ...sampleCounterparty, archivedAt: null }),
      countTransactions: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue(undefined),
      merge: vi.fn().mockResolvedValue(undefined),
    };

    mockCtx = {
      userId: vi.fn().mockReturnValue(USER_1),
      newId: vi.fn().mockReturnValue(CP_1),
      now: vi.fn().mockReturnValue(new Date('2026-01-01T00:00:00.000Z')),
    };

    service = new CounterpartiesService(
      mockCtx as unknown as FinanceContext,
      mockRepo as unknown as CounterpartiesRepository,
    );
  });

  describe('create', () => {
    it('creates a counterparty successfully', async () => {
      const res = await service.create({
        name: 'Boulangerie du Coin',
        kind: 'PERSON',
        phone: '+221770000000',
        email: 'contact@boulangerie.sn',
        notes: 'Fournisseur pain',
      });

      expect(res.id).toBe(CP_1);
      expect(res.name).toBe('Boulangerie du Coin');
      expect(res.kind).toBe('PERSON');
      expect(res.transactionCount).toBe(3);
    });

    it('rejects creation if active counterparty with same name already exists', async () => {
      mockRepo.findByName.mockResolvedValue(sampleCounterparty);

      await expect(
        service.create({
          name: 'Boulangerie du Coin',
          kind: 'PERSON',
        }),
      ).rejects.toThrow(DomainError);
    });

    it('allows creation if counterparty with same name was archived', async () => {
      mockRepo.findByName.mockResolvedValue({
        ...sampleCounterparty,
        archivedAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      const res = await service.create({
        name: 'Boulangerie du Coin',
        kind: 'PERSON',
      });
      expect(res.id).toBe(CP_1);
    });
  });

  describe('get', () => {
    it('returns counterparty details', async () => {
      const res = await service.get(CP_1);
      expect(res.id).toBe(CP_1);
      expect(res.name).toBe('Boulangerie du Coin');
    });

    it('throws NOT_FOUND when counterparty does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.get(CP_1)).rejects.toThrow(DomainError);
    });
  });

  describe('list', () => {
    it('lists counterparties with pagination', async () => {
      const res = await service.list({
        limit: 10,
        search: 'Boulangerie',
      });

      expect(res.data).toHaveLength(1);
      expect(res.meta.limit).toBe(10);
      expect(res.meta.hasMore).toBe(false);
      expect(res.meta.nextCursor).toBeNull();
    });
  });

  describe('update', () => {
    it('updates counterparty fields', async () => {
      const res = await service.update(CP_1, {
        name: 'Boulangerie Modifiée',
        kind: 'ORGANIZATION',
      });

      expect(res.name).toBe('Boulangerie Modifiée');
    });

    it('throws CONFLICT if new name is already taken by another active counterparty', async () => {
      mockRepo.findByName.mockResolvedValue({
        ...sampleCounterparty,
        id: CP_2,
        name: 'Autre Boulangerie',
      });

      await expect(
        service.update(CP_1, {
          name: 'Autre Boulangerie',
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws NOT_FOUND if counterparty does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.update(CP_1, { name: 'Test' })).rejects.toThrow(DomainError);
    });
  });

  describe('archive and unarchive', () => {
    it('archives counterparty', async () => {
      const res = await service.archive(CP_1);
      expect(res.archivedAt).not.toBeNull();
    });

    it('unarchives counterparty', async () => {
      mockRepo.findById.mockResolvedValue({
        ...sampleCounterparty,
        archivedAt: new Date('2026-02-01T00:00:00.000Z'),
      });

      const res = await service.unarchive(CP_1);
      expect(res.archivedAt).toBeNull();
    });

    it('throws CONFLICT when unarchiving if active counterparty already has same name', async () => {
      mockRepo.findById.mockResolvedValue({
        ...sampleCounterparty,
        archivedAt: new Date('2026-02-01T00:00:00.000Z'),
      });
      mockRepo.findByName.mockResolvedValue({
        ...sampleCounterparty,
        id: CP_2,
        archivedAt: null,
      });

      await expect(service.unarchive(CP_1)).rejects.toThrow(DomainError);
    });
  });

  describe('delete', () => {
    it('deletes counterparty when unused', async () => {
      mockRepo.countTransactions.mockResolvedValue(0);
      await service.delete(CP_1);
      expect(mockRepo.delete).toHaveBeenCalledWith(USER_1, CP_1);
    });

    it('throws BUSINESS_RULE_VIOLATION if counterparty is referenced in transactions', async () => {
      mockRepo.countTransactions.mockResolvedValue(2);
      await expect(service.delete(CP_1)).rejects.toThrow(DomainError);
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('merge', () => {
    it('merges source into target counterparty', async () => {
      mockRepo.findById
        .mockResolvedValueOnce(sampleCounterparty) // source
        .mockResolvedValueOnce({ ...sampleCounterparty, id: CP_2, name: 'Cible' }) // target
        .mockResolvedValueOnce({ ...sampleCounterparty, id: CP_2, name: 'Cible' }); // target response

      const res = await service.merge(CP_1, { targetCounterpartyId: CP_2 });
      expect(mockRepo.merge).toHaveBeenCalledWith(USER_1, CP_1, CP_2);
      expect(res.id).toBe(CP_2);
    });

    it('rejects merging counterparty with itself', async () => {
      await expect(service.merge(CP_1, { targetCounterpartyId: CP_1 })).rejects.toThrow(DomainError);
    });

    it('throws NOT_FOUND if source counterparty does not exist', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.merge(CP_1, { targetCounterpartyId: CP_2 })).rejects.toThrow(DomainError);
    });

    it('throws NOT_FOUND if target counterparty does not exist', async () => {
      mockRepo.findById.mockResolvedValueOnce(sampleCounterparty).mockResolvedValueOnce(null);

      await expect(service.merge(CP_1, { targetCounterpartyId: CP_2 })).rejects.toThrow(DomainError);
    });
  });
});
