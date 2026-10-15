import { Injectable } from '@nestjs/common';
import type { CategoryKind, EconomicClass, Prisma, TransactionCategory } from '@prisma/client';

import { FinanceContext } from '../shared/finance-context';

export interface CreateCategoryDbInput {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly kind: CategoryKind;
  readonly defaultEconomicClass: EconomicClass;
  readonly parentId?: string | null;
  readonly icon?: string | null;
  readonly color?: string | null;
  readonly isSystem?: boolean;
  readonly systemKey?: string | null;
  readonly sortOrder?: number;
}

export interface ListCategoriesFilters {
  readonly kind?: CategoryKind;
  readonly parentId?: string;
}

@Injectable()
export class CategoriesRepository {
  constructor(private readonly ctx: FinanceContext) {}

  async create(data: CreateCategoryDbInput): Promise<TransactionCategory> {
    return this.ctx.db.transactionCategory.create({
      data: {
        id: data.id,
        userId: data.userId,
        name: data.name,
        kind: data.kind,
        defaultEconomicClass: data.defaultEconomicClass,
        parentId: data.parentId ?? null,
        icon: data.icon ?? null,
        color: data.color ?? null,
        isSystem: data.isSystem ?? false,
        systemKey: data.systemKey ?? null,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async createMany(items: readonly CreateCategoryDbInput[]): Promise<number> {
    const result = await this.ctx.db.transactionCategory.createMany({
      data: items.map((item) => ({
        id: item.id,
        userId: item.userId,
        name: item.name,
        kind: item.kind,
        defaultEconomicClass: item.defaultEconomicClass,
        parentId: item.parentId ?? null,
        icon: item.icon ?? null,
        color: item.color ?? null,
        isSystem: item.isSystem ?? false,
        systemKey: item.systemKey ?? null,
        sortOrder: item.sortOrder ?? 0,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async findById(userId: string, id: string): Promise<TransactionCategory | null> {
    return this.ctx.db.transactionCategory.findFirst({
      where: { userId, id },
    });
  }

  async findBySystemKey(userId: string, systemKey: string): Promise<TransactionCategory | null> {
    return this.ctx.db.transactionCategory.findFirst({
      where: { userId, systemKey },
    });
  }

  async findByNameAndParent(
    userId: string,
    name: string,
    parentId?: string | null,
  ): Promise<TransactionCategory | null> {
    return this.ctx.db.transactionCategory.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
        parentId: parentId ?? null,
      },
    });
  }

  async list(userId: string, filters: ListCategoriesFilters = {}): Promise<TransactionCategory[]> {
    return this.ctx.db.transactionCategory.findMany({
      where: {
        userId,
        ...(filters.kind ? { kind: filters.kind } : {}),
        ...(filters.parentId !== undefined ? { parentId: filters.parentId } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async update(
    userId: string,
    id: string,
    data: Prisma.TransactionCategoryUpdateInput,
  ): Promise<TransactionCategory> {
    return this.ctx.db.transactionCategory.update({
      where: {
        userId_id: { userId, id },
      },
      data,
    });
  }

  async delete(userId: string, id: string): Promise<TransactionCategory> {
    return this.ctx.db.transactionCategory.delete({
      where: {
        userId_id: { userId, id },
      },
    });
  }

  async countTransactions(userId: string, categoryId: string): Promise<number> {
    return this.ctx.db.transaction.count({
      where: { userId, categoryId },
    });
  }

  async hasChildren(userId: string, categoryId: string): Promise<boolean> {
    const count = await this.ctx.db.transactionCategory.count({
      where: { userId, parentId: categoryId },
    });
    return count > 0;
  }

  async count(userId: string): Promise<number> {
    return this.ctx.db.transactionCategory.count({
      where: { userId },
    });
  }
}
