import { Injectable } from '@nestjs/common';

import type {
  CounterpartyListEnvelope,
  CounterpartyResponse,
  CreateCounterparty,
  ListCounterpartiesQuery,
  MergeCounterparty,
  UpdateCounterparty,
} from '@orbit/contracts';

import { DomainError } from '../../../platform/errors/domain-error';
import { FinanceContext } from '../shared/finance-context';

import { CounterpartiesRepository, type CounterpartyWithCount } from './counterparties.repository';

function toCounterpartyResponse(row: CounterpartyWithCount): CounterpartyResponse {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    transactionCount: row._count?.transactions ?? 0,
  };
}

@Injectable()
export class CounterpartiesService {
  constructor(
    private readonly ctx: FinanceContext,
    private readonly repo: CounterpartiesRepository,
  ) {}

  async create(input: CreateCounterparty): Promise<CounterpartyResponse> {
    const userId = this.ctx.userId();
    const existing = await this.repo.findByName(userId, input.name);
    if (existing && !existing.archivedAt) {
      throw new DomainError('CONFLICT', 'Une contrepartie active porte déjà ce nom.', {
        field: 'name',
      });
    }

    const id = this.ctx.newId();
    const created = await this.repo.create({
      id,
      userId,
      name: input.name,
      kind: input.kind,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
    });

    return toCounterpartyResponse(created);
  }

  async get(id: string): Promise<CounterpartyResponse> {
    const userId = this.ctx.userId();
    const item = await this.repo.findById(userId, id);
    if (!item) {
      throw new DomainError('NOT_FOUND', 'Contrepartie introuvable.');
    }
    return toCounterpartyResponse(item);
  }

  async list(query: ListCounterpartiesQuery): Promise<CounterpartyListEnvelope> {
    const userId = this.ctx.userId();
    const page = await this.repo.list(userId, {
      kind: query.kind,
      search: query.search,
      includeArchived: query.includeArchived,
      limit: query.limit,
      cursor: query.cursor,
    });

    return {
      data: page.rows.map(toCounterpartyResponse),
      meta: {
        limit: query.limit,
        hasMore: page.hasMore,
        nextCursor: page.nextCursor,
      },
    };
  }

  async update(id: string, input: UpdateCounterparty): Promise<CounterpartyResponse> {
    const userId = this.ctx.userId();
    const existing = await this.repo.findById(userId, id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Contrepartie introuvable.');
    }

    if (input.name !== undefined && input.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const conflict = await this.repo.findByName(userId, input.name);
      if (conflict && conflict.id !== id && !conflict.archivedAt) {
        throw new DomainError('CONFLICT', 'Une contrepartie active porte déjà ce nom.', {
          field: 'name',
        });
      }
    }

    const updated = await this.repo.update(userId, id, {
      name: input.name,
      kind: input.kind,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
    });

    return toCounterpartyResponse(updated);
  }

  async archive(id: string): Promise<CounterpartyResponse> {
    const userId = this.ctx.userId();
    const existing = await this.repo.findById(userId, id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Contrepartie introuvable.');
    }

    const archived = await this.repo.archive(userId, id, this.ctx.now());
    return toCounterpartyResponse(archived);
  }

  async unarchive(id: string): Promise<CounterpartyResponse> {
    const userId = this.ctx.userId();
    const existing = await this.repo.findById(userId, id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Contrepartie introuvable.');
    }

    const conflict = await this.repo.findByName(userId, existing.name);
    if (conflict && conflict.id !== id && !conflict.archivedAt) {
      throw new DomainError('CONFLICT', 'Une contrepartie active porte déjà ce nom.', {
        field: 'name',
      });
    }

    const unarchived = await this.repo.unarchive(userId, id);
    return toCounterpartyResponse(unarchived);
  }

  async delete(id: string): Promise<void> {
    const userId = this.ctx.userId();
    const existing = await this.repo.findById(userId, id);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Contrepartie introuvable.');
    }

    const txCount = await this.repo.countTransactions(userId, id);
    if (txCount > 0) {
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        'Impossible de supprimer une contrepartie liée à des transactions existantes. Utilisez l’archivage.',
      );
    }

    await this.repo.delete(userId, id);
  }

  async merge(id: string, input: MergeCounterparty): Promise<CounterpartyResponse> {
    const userId = this.ctx.userId();
    if (input.targetCounterpartyId === id) {
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        'Impossible de fusionner une contrepartie avec elle-même.',
      );
    }

    const source = await this.repo.findById(userId, id);
    if (!source) {
      throw new DomainError('NOT_FOUND', 'Contrepartie source introuvable.');
    }

    const target = await this.repo.findById(userId, input.targetCounterpartyId);
    if (!target) {
      throw new DomainError('NOT_FOUND', 'Contrepartie cible introuvable.');
    }

    await this.repo.merge(userId, id, input.targetCounterpartyId);
    const updatedTarget = await this.repo.findById(userId, input.targetCounterpartyId);
    return toCounterpartyResponse(updatedTarget ?? target);
  }
}
