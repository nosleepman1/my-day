import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CounterpartyResponse } from '@orbit/contracts';

import { CounterpartiesController } from './counterparties.controller';
import type { CounterpartiesService } from './counterparties.service';

const CP_ID = '01927000-0000-7000-8000-000000000001';
const CP_ID_2 = '01927000-0000-7000-8000-000000000002';

const sampleCounterparty: CounterpartyResponse = {
  id: CP_ID,
  name: 'Boulangerie du Coin',
  kind: 'PERSON',
  phone: '+221770000000',
  email: 'contact@boulangerie.sn',
  notes: 'Fournisseur pain',
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  transactionCount: 3,
};

describe('CounterpartiesController', () => {
  let controller: CounterpartiesController;
  let mockService: {
    create: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    archive: ReturnType<typeof vi.fn>;
    unarchive: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    merge: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockService = {
      create: vi.fn().mockResolvedValue(sampleCounterparty),
      list: vi.fn().mockResolvedValue({
        data: [sampleCounterparty],
        meta: { limit: 25, hasMore: false, nextCursor: null },
      }),
      get: vi.fn().mockResolvedValue(sampleCounterparty),
      update: vi.fn().mockResolvedValue({ ...sampleCounterparty, name: 'Boulangerie Artisanale' }),
      archive: vi.fn().mockResolvedValue({ ...sampleCounterparty, archivedAt: '2026-02-01T00:00:00.000Z' }),
      unarchive: vi.fn().mockResolvedValue({ ...sampleCounterparty, archivedAt: null }),
      delete: vi.fn().mockResolvedValue(undefined),
      merge: vi.fn().mockResolvedValue({ ...sampleCounterparty, id: CP_ID_2 }),
    };

    controller = new CounterpartiesController(mockService as unknown as CounterpartiesService);
  });

  it('delegates creation to service and returns data envelope', async () => {
    const res = await controller.create({
      name: 'Boulangerie du Coin',
      kind: 'PERSON',
    });

    expect(res).toEqual({ data: sampleCounterparty });
    expect(mockService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Boulangerie du Coin', kind: 'PERSON' }),
    );
  });

  it('delegates list to service with query params', async () => {
    const res = await controller.list({ limit: 25, search: 'Boulangerie' });
    expect(res.data).toHaveLength(1);
    expect(mockService.list).toHaveBeenCalledWith({ limit: 25, search: 'Boulangerie' });
  });

  it('delegates getById to service', async () => {
    const res = await controller.get({ id: CP_ID });
    expect(res).toEqual({ data: sampleCounterparty });
    expect(mockService.get).toHaveBeenCalledWith(CP_ID);
  });

  it('delegates update to service', async () => {
    const res = await controller.update({ id: CP_ID }, { name: 'Boulangerie Artisanale' });
    expect(res.data.name).toBe('Boulangerie Artisanale');
    expect(mockService.update).toHaveBeenCalledWith(CP_ID, { name: 'Boulangerie Artisanale' });
  });

  it('delegates archive to service', async () => {
    const res = await controller.archive({ id: CP_ID });
    expect(res.data.archivedAt).toBe('2026-02-01T00:00:00.000Z');
    expect(mockService.archive).toHaveBeenCalledWith(CP_ID);
  });

  it('delegates unarchive to service', async () => {
    const res = await controller.unarchive({ id: CP_ID });
    expect(res.data.archivedAt).toBeNull();
    expect(mockService.unarchive).toHaveBeenCalledWith(CP_ID);
  });

  it('delegates delete to service and returns 204 or empty', async () => {
    await controller.delete({ id: CP_ID });
    expect(mockService.delete).toHaveBeenCalledWith(CP_ID);
  });

  it('delegates merge to service', async () => {
    const res = await controller.merge({ id: CP_ID }, { targetCounterpartyId: CP_ID_2 });
    expect(res.data.id).toBe(CP_ID_2);
    expect(mockService.merge).toHaveBeenCalledWith(CP_ID, { targetCounterpartyId: CP_ID_2 });
  });
});
