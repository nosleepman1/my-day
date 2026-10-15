import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import type { FinanceContext } from '../shared/finance-context';

import type { AccountsRepository } from './accounts.repository';
import { AccountsService } from './accounts.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const ACCOUNT_1 = '01927000-0000-7000-8000-000000000002';

describe('AccountsService', () => {
  let service: AccountsService;
  let mockCtx: {
    userId: ReturnType<typeof vi.fn>;
    newId: ReturnType<typeof vi.fn>;
    now: ReturnType<typeof vi.fn>;
  };
  let mockRepo: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByName: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    getBalance: ReturnType<typeof vi.fn>;
  };
  let mockAudit: {
    record: ReturnType<typeof vi.fn>;
  };

  const sampleAccount = {
    id: ACCOUNT_1,
    userId: USER_1,
    name: 'Compte Courant',
    type: 'BANK' as const,
    provider: 'SGBS',
    currency: 'XOF',
    openingBalanceMinor: 100_000n,
    openedOn: new Date('2026-01-01'),
    allowOverdraft: false,
    overdraftLimitMinor: null,
    includeInNetWorth: true,
    color: '#00AA00',
    icon: 'bank',
    notes: 'Compte principal',
    archivedAt: null,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
  };

  beforeEach(() => {
    mockCtx = {
      userId: vi.fn().mockReturnValue(USER_1),
      newId: vi.fn().mockReturnValue(ACCOUNT_1),
      now: vi.fn().mockReturnValue(new Date('2026-10-15T12:00:00Z')),
    };

    mockRepo = {
      create: vi.fn().mockResolvedValue(sampleAccount),
      findById: vi.fn().mockResolvedValue(sampleAccount),
      findByName: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([sampleAccount]),
      update: vi.fn().mockResolvedValue(sampleAccount),
      getBalance: vi.fn().mockResolvedValue({ realisedMinor: 100_000n, projectedMinor: 100_000n }),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new AccountsService(
      mockCtx as unknown as FinanceContext,
      mockRepo as unknown as AccountsRepository,
      mockAudit as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('creates an account with initial opening balance', async () => {
      const res = await service.create({
        name: 'Compte Courant',
        type: 'BANK',
        currency: 'XOF',
        openingBalanceMinor: '100000',
        openedOn: '2026-01-01',
      });

      expect(res.name).toBe('Compte Courant');
      expect(res.currentBalanceMinor).toBe('100000');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_1,
          name: 'Compte Courant',
          openingBalanceMinor: 100_000n,
        }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.account.create',
          userId: USER_1,
          entityId: ACCOUNT_1,
        }),
      );
    });

    it('rejects duplicate name for same user with 409 CONFLICT', async () => {
      mockRepo.findByName.mockResolvedValueOnce(sampleAccount);

      await expect(
        service.create({
          name: 'Compte Courant',
          type: 'BANK',
          currency: 'XOF',
          openedOn: '2026-01-01',
        }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('getById & isolation', () => {
    it('returns the account with its calculated balance', async () => {
      const res = await service.getById(ACCOUNT_1);
      expect(res.id).toBe(ACCOUNT_1);
      expect(res.currentBalanceMinor).toBe('100000');
    });

    it('returns 404 NOT_FOUND when accessing non-existent or foreign account', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);

      await expect(service.getById('foreign-or-missing-id')).rejects.toThrow(DomainError);
      try {
        await service.getById('foreign-or-missing-id');
      } catch (err) {
        expect((err as DomainError).code).toBe('NOT_FOUND');
      }
    });
  });

  describe('update', () => {
    it('updates allowed fields successfully', async () => {
      mockRepo.update.mockResolvedValueOnce({
        ...sampleAccount,
        name: 'Compte Courant Modifié',
      });

      const res = await service.update(ACCOUNT_1, {
        name: 'Compte Courant Modifié',
      });

      expect(res.name).toBe('Compte Courant Modifié');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.account.update',
          userId: USER_1,
          entityId: ACCOUNT_1,
        }),
      );
    });

    it('rejects update if account is archived', async () => {
      mockRepo.findById.mockResolvedValueOnce({
        ...sampleAccount,
        archivedAt: new Date('2026-06-01T00:00:00.000Z'),
      });

      await expect(service.update(ACCOUNT_1, { name: 'Nouveau' })).rejects.toThrow(DomainError);
    });

    it('rejects disabling overdraft if current balance is negative', async () => {
      mockRepo.findById.mockResolvedValueOnce({
        ...sampleAccount,
        allowOverdraft: true,
      });
      mockRepo.getBalance.mockResolvedValueOnce({
        realisedMinor: -20_000n,
        projectedMinor: -20_000n,
      });

      await expect(service.update(ACCOUNT_1, { allowOverdraft: false })).rejects.toThrow(DomainError);
    });
  });

  describe('close and reopen', () => {
    it('closes an active account by setting archivedAt', async () => {
      mockRepo.update.mockResolvedValueOnce({
        ...sampleAccount,
        archivedAt: new Date('2026-10-15T12:00:00Z'),
      });

      const res = await service.close(ACCOUNT_1);
      expect(res.archivedAt).toBe('2026-10-15T12:00:00.000Z');
      expect(mockRepo.update).toHaveBeenCalledWith(
        USER_1,
        ACCOUNT_1,
        expect.objectContaining({ archivedAt: expect.any(Date) }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.account.close',
          userId: USER_1,
          entityId: ACCOUNT_1,
        }),
      );
    });

    it('rejects closing an already archived account', async () => {
      mockRepo.findById.mockResolvedValueOnce({
        ...sampleAccount,
        archivedAt: new Date('2026-06-01T00:00:00.000Z'),
      });

      await expect(service.close(ACCOUNT_1)).rejects.toThrow(DomainError);
    });

    it('reopens an archived account', async () => {
      mockRepo.findById.mockResolvedValueOnce({
        ...sampleAccount,
        archivedAt: new Date('2026-06-01T00:00:00.000Z'),
      });
      mockRepo.update.mockResolvedValueOnce({
        ...sampleAccount,
        archivedAt: null,
      });

      const res = await service.reopen(ACCOUNT_1);
      expect(res.archivedAt).toBeNull();
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.account.reopen',
          userId: USER_1,
          entityId: ACCOUNT_1,
        }),
      );
    });

    it('rejects reopening an account that is not archived', async () => {
      await expect(service.reopen(ACCOUNT_1)).rejects.toThrow(DomainError);
    });
  });
});
