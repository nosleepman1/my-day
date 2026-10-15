import { Injectable } from '@nestjs/common';
import type { FinancialAccount, Prisma } from '@prisma/client';

import {
  CreateAccountSchema,
  type AccountResponse,
  type CloseAccount,
  type CreateAccount,
  type CreateAccountInput,
  type CurrencyCode,
  type ListAccountsQuery,
  type ReopenAccount,
  type UpdateAccount,
} from '@orbit/contracts';
import { assertCurrencyCode } from '@orbit/money';

import { DomainError } from '../../../platform/errors/domain-error';
import { defaultMessageOf } from '../../../platform/http/error-mapping';
import type { CalculatedBalance } from '../domain/balance-calculator';
import { FinanceContext } from '../shared/finance-context';

import { AccountsRepository } from './accounts.repository';

function notFound(): DomainError {
  return new DomainError('NOT_FOUND', defaultMessageOf('NOT_FOUND'));
}

function toAccountResponse(account: FinancialAccount, balance: CalculatedBalance): AccountResponse {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    provider: account.provider,
    currency: account.currency as CurrencyCode,
    currentBalanceMinor: balance.realisedMinor.toString(),
    openingBalanceMinor: account.openingBalanceMinor.toString(),
    openedOn: account.openedOn.toISOString().slice(0, 10),
    allowOverdraft: account.allowOverdraft,
    overdraftLimitMinor: account.overdraftLimitMinor !== null ? account.overdraftLimitMinor.toString() : null,
    includeInNetWorth: account.includeInNetWorth,
    color: account.color,
    icon: account.icon,
    notes: account.notes,
    archivedAt: account.archivedAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function assertAccountNotArchived(account: FinancialAccount): void {
  if (account.archivedAt !== null) {
    throw new DomainError('BUSINESS_RULE_VIOLATION', 'Un compte archivé ne peut pas être modifié.', {
      rule: 'ACCOUNT_ARCHIVED',
    });
  }
}

function buildAccountUpdateData(dto: UpdateAccount): Prisma.FinancialAccountUpdateInput {
  return {
    ...(dto.name !== undefined ? { name: dto.name } : {}),
    ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
    ...(dto.allowOverdraft !== undefined ? { allowOverdraft: dto.allowOverdraft } : {}),
    ...(dto.overdraftLimitMinor !== undefined
      ? { overdraftLimitMinor: dto.overdraftLimitMinor ? BigInt(dto.overdraftLimitMinor) : null }
      : {}),
    ...(dto.includeInNetWorth !== undefined ? { includeInNetWorth: dto.includeInNetWorth } : {}),
    ...(dto.color !== undefined ? { color: dto.color } : {}),
    ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
    ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
  };
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly ctx: FinanceContext,
    private readonly repo: AccountsRepository,
  ) {}

  private async assertNameAvailable(
    userId: string,
    name: string | undefined,
    currentName: string,
  ): Promise<void> {
    if (name && name !== currentName) {
      const existing = await this.repo.findByName(userId, name);
      if (existing) {
        throw new DomainError('CONFLICT', 'Un compte avec ce nom existe déjà.', {
          field: 'name',
        });
      }
    }
  }

  private async assertOverdraftDeactivationAllowed(
    userId: string,
    id: string,
    dto: UpdateAccount,
    account: FinancialAccount,
  ): Promise<void> {
    if (dto.allowOverdraft === false && account.allowOverdraft) {
      const balance = await this.repo.getBalance(userId, id);
      if (balance && balance.realisedMinor < 0n) {
        throw new DomainError(
          'INSUFFICIENT_FUNDS',
          'Impossible de désactiver le découvert sur un compte actuellement à découvert.',
          {
            available: balance.realisedMinor.toString(),
            required: '0',
          },
        );
      }
    }
  }

  async create(rawDto: CreateAccountInput): Promise<AccountResponse> {
    const dto: CreateAccount = CreateAccountSchema.parse(rawDto);
    const userId = this.ctx.userId();
    assertCurrencyCode(dto.currency);

    const existing = await this.repo.findByName(userId, dto.name);
    if (existing) {
      throw new DomainError('CONFLICT', 'Un compte avec ce nom existe déjà.', {
        field: 'name',
      });
    }

    const openingBalance = BigInt(dto.openingBalanceMinor);
    const id = this.ctx.newId();

    const account = await this.repo.create({
      id,
      userId,
      name: dto.name,
      type: dto.type,
      provider: dto.provider,
      currency: dto.currency,
      openingBalanceMinor: openingBalance,
      openedOn: new Date(dto.openedOn),
      allowOverdraft: dto.allowOverdraft,
      overdraftLimitMinor: dto.overdraftLimitMinor ? BigInt(dto.overdraftLimitMinor) : null,
      includeInNetWorth: dto.includeInNetWorth,
      color: dto.color,
      icon: dto.icon,
      notes: dto.notes,
    });

    const initialBalance: CalculatedBalance = {
      realisedMinor: openingBalance,
      projectedMinor: openingBalance,
    };

    return toAccountResponse(account, initialBalance);
  }

  async getById(id: string): Promise<AccountResponse> {
    const userId = this.ctx.userId();
    const account = await this.repo.findById(userId, id);
    if (!account) {
      throw notFound();
    }

    const balance = await this.repo.getBalance(userId, id);
    return toAccountResponse(
      account,
      balance ?? { realisedMinor: account.openingBalanceMinor, projectedMinor: account.openingBalanceMinor },
    );
  }

  async list(query: ListAccountsQuery = {}): Promise<AccountResponse[]> {
    const userId = this.ctx.userId();
    const accounts = await this.repo.list(userId, query);

    const results: AccountResponse[] = [];
    for (const account of accounts) {
      const balance = await this.repo.getBalance(userId, account.id);
      results.push(
        toAccountResponse(
          account,
          balance ?? {
            realisedMinor: account.openingBalanceMinor,
            projectedMinor: account.openingBalanceMinor,
          },
        ),
      );
    }
    return results;
  }

  async update(id: string, dto: UpdateAccount): Promise<AccountResponse> {
    const userId = this.ctx.userId();
    const account = await this.repo.findById(userId, id);
    if (!account) {
      throw notFound();
    }

    assertAccountNotArchived(account);
    await this.assertNameAvailable(userId, dto.name, account.name);
    await this.assertOverdraftDeactivationAllowed(userId, id, dto, account);

    const updateData = buildAccountUpdateData(dto);
    const updated = await this.repo.update(userId, id, updateData);

    const currentBalance = await this.repo.getBalance(userId, id);
    return toAccountResponse(
      updated,
      currentBalance ?? {
        realisedMinor: updated.openingBalanceMinor,
        projectedMinor: updated.openingBalanceMinor,
      },
    );
  }

  async close(id: string, dto: CloseAccount = {}): Promise<AccountResponse> {
    const userId = this.ctx.userId();
    const account = await this.repo.findById(userId, id);
    if (!account) {
      throw notFound();
    }

    if (account.archivedAt !== null) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', 'Ce compte est déjà clôturé/archivé.');
    }

    const updated = await this.repo.update(userId, id, {
      archivedAt: this.ctx.now(),
      ...(dto.notes ? { notes: dto.notes } : {}),
    });

    const balance = await this.repo.getBalance(userId, id);
    return toAccountResponse(
      updated,
      balance ?? { realisedMinor: updated.openingBalanceMinor, projectedMinor: updated.openingBalanceMinor },
    );
  }

  async reopen(id: string, dto: ReopenAccount = {}): Promise<AccountResponse> {
    const userId = this.ctx.userId();
    const account = await this.repo.findById(userId, id);
    if (!account) {
      throw notFound();
    }

    if (account.archivedAt === null) {
      throw new DomainError('BUSINESS_RULE_VIOLATION', "Ce compte n'est pas archivé.");
    }

    const updated = await this.repo.update(userId, id, {
      archivedAt: null,
      ...(dto.notes ? { notes: dto.notes } : {}),
    });

    const balance = await this.repo.getBalance(userId, id);
    return toAccountResponse(
      updated,
      balance ?? { realisedMinor: updated.openingBalanceMinor, projectedMinor: updated.openingBalanceMinor },
    );
  }
}
