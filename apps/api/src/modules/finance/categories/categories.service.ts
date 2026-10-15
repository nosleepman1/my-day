import { Injectable } from '@nestjs/common';
import type { Prisma, TransactionCategory } from '@prisma/client';

import type {
  CategoryKind,
  CategoryResponse,
  CreateCategory,
  ListCategoriesQuery,
  UpdateCategory,
} from '@orbit/contracts';

import { DomainError } from '../../../platform/errors/domain-error';
import { defaultMessageOf } from '../../../platform/http/error-mapping';
import { FinanceContext } from '../shared/finance-context';

import { SENEGALESE_DEFAULT_CATEGORIES } from './categories.default-seed';
import { CategoriesRepository } from './categories.repository';

function notFound(): DomainError {
  return new DomainError('NOT_FOUND', defaultMessageOf('NOT_FOUND'));
}

function toCategoryResponse(category: TransactionCategory): CategoryResponse {
  return {
    id: category.id,
    name: category.name,
    kind: category.kind,
    defaultEconomicClass: category.defaultEconomicClass,
    parentId: category.parentId,
    icon: category.icon,
    color: category.color,
    isSystem: category.isSystem,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

function assertSystemCategoryImmutable(category: TransactionCategory, dto: UpdateCategory): void {
  if (!category.isSystem) {
    return;
  }
  if (dto.name && dto.name !== category.name) {
    throw new DomainError('BUSINESS_RULE_VIOLATION', 'Une catégorie système ne peut pas être renommée.', {
      rule: 'SYSTEM_CATEGORY_IMMUTABLE',
    });
  }
  if (dto.parentId !== undefined && dto.parentId !== category.parentId) {
    throw new DomainError(
      'BUSINESS_RULE_VIOLATION',
      "Le parent d'une catégorie système ne peut pas être modifié.",
      {
        rule: 'SYSTEM_CATEGORY_IMMUTABLE',
      },
    );
  }
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly ctx: FinanceContext,
    private readonly repo: CategoriesRepository,
  ) {}

  async ensureDefaultCategories(userId: string): Promise<void> {
    const count = await this.repo.count(userId);
    if (count > 0) {
      return;
    }

    const items = SENEGALESE_DEFAULT_CATEGORIES.map((cat) => ({
      id: this.ctx.newId(),
      userId,
      name: cat.name,
      kind: cat.kind,
      defaultEconomicClass: cat.defaultEconomicClass,
      icon: cat.icon,
      color: cat.color,
      isSystem: cat.isSystem ?? false,
      systemKey: cat.systemKey ?? null,
      sortOrder: cat.sortOrder,
    }));

    await this.repo.createMany(items);
  }

  private async assertParentValid(
    userId: string,
    parentId: string | null | undefined,
    expectedKind: CategoryKind,
    currentCategoryId?: string,
  ): Promise<void> {
    if (!parentId) {
      return;
    }
    if (currentCategoryId && parentId === currentCategoryId) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Une catégorie ne peut pas être son propre parent.', {
        rule: 'CIRCULAR_CATEGORY_DEPENDENCY',
      });
    }

    const parent = await this.repo.findById(userId, parentId);
    if (!parent) {
      throw notFound();
    }
    if (parent.kind !== expectedKind) {
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        'Le parent doit avoir la même nature (revenu ou dépense).',
        {
          rule: 'CATEGORY_KIND_MISMATCH',
        },
      );
    }
    if (parent.parentId !== null) {
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        'La hiérarchie des catégories est limitée à 1 niveau.',
        {
          rule: 'CATEGORY_MAX_DEPTH_EXCEEDED',
        },
      );
    }
  }

  private async assertNameAvailable(
    userId: string,
    name: string,
    parentId: string | null | undefined,
  ): Promise<void> {
    const existing = await this.repo.findByNameAndParent(userId, name, parentId);
    if (existing) {
      throw new DomainError('CONFLICT', 'Une catégorie avec ce nom existe déjà à ce niveau.', {
        field: 'name',
      });
    }
  }

  async create(dto: CreateCategory): Promise<CategoryResponse> {
    const userId = this.ctx.userId();

    await this.assertParentValid(userId, dto.parentId, dto.kind);
    await this.assertNameAvailable(userId, dto.name, dto.parentId);

    const category = await this.repo.create({
      id: this.ctx.newId(),
      userId,
      name: dto.name,
      kind: dto.kind,
      defaultEconomicClass: dto.defaultEconomicClass,
      parentId: dto.parentId ?? null,
      icon: dto.icon,
      color: dto.color,
    });

    return toCategoryResponse(category);
  }

  async getById(id: string): Promise<CategoryResponse> {
    const userId = this.ctx.userId();
    const category = await this.repo.findById(userId, id);
    if (!category) {
      throw notFound();
    }
    return toCategoryResponse(category);
  }

  async list(query: ListCategoriesQuery = {}): Promise<CategoryResponse[]> {
    const userId = this.ctx.userId();
    await this.ensureDefaultCategories(userId);

    const categories = await this.repo.list(userId, query);
    return categories.map(toCategoryResponse);
  }

  private async assertTargetParentValid(
    userId: string,
    category: TransactionCategory,
    newParentId: string | null | undefined,
  ): Promise<void> {
    if (!newParentId) {
      return;
    }
    const hasChildren = await this.repo.hasChildren(userId, category.id);
    if (hasChildren) {
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        'Une catégorie parent ne peut pas devenir sous-catégorie.',
        {
          rule: 'CATEGORY_MAX_DEPTH_EXCEEDED',
        },
      );
    }
    await this.assertParentValid(userId, newParentId, category.kind, category.id);
  }

  private async validateUpdatePreconditions(
    userId: string,
    category: TransactionCategory,
    dto: UpdateCategory,
  ): Promise<void> {
    assertSystemCategoryImmutable(category, dto);

    const targetParentId = dto.parentId !== undefined ? dto.parentId : category.parentId;
    await this.assertTargetParentValid(userId, category, dto.parentId);

    const targetName = dto.name ?? category.name;
    const isSameName = targetName.toLowerCase() === category.name.toLowerCase();
    const isSameParent = targetParentId === category.parentId;
    if (!isSameName || !isSameParent) {
      await this.assertNameAvailable(userId, targetName, targetParentId);
    }
  }

  async update(id: string, dto: UpdateCategory): Promise<CategoryResponse> {
    const userId = this.ctx.userId();
    const category = await this.repo.findById(userId, id);
    if (!category) {
      throw notFound();
    }

    await this.validateUpdatePreconditions(userId, category, dto);

    const updateData: Prisma.TransactionCategoryUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.defaultEconomicClass !== undefined ? { defaultEconomicClass: dto.defaultEconomicClass } : {}),
      ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
      ...(dto.color !== undefined ? { color: dto.color } : {}),
    };

    const updated = await this.repo.update(userId, id, updateData);
    return toCategoryResponse(updated);
  }

  async delete(id: string): Promise<void> {
    const userId = this.ctx.userId();
    const category = await this.repo.findById(userId, id);
    if (!category) {
      throw notFound();
    }

    if (category.isSystem) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Une catégorie système ne peut pas être supprimée.', {
        rule: 'SYSTEM_CATEGORY_CANNOT_BE_DELETED',
      });
    }

    const hasChildren = await this.repo.hasChildren(userId, id);
    if (hasChildren) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Cette catégorie contient des sous-catégories.', {
        rule: 'CATEGORY_HAS_CHILDREN',
      });
    }

    const txCount = await this.repo.countTransactions(userId, id);
    if (txCount > 0) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Une catégorie utilisée ne peut pas être supprimée.', {
        rule: 'CATEGORY_IN_USE',
      });
    }

    await this.repo.delete(userId, id);
  }
}
