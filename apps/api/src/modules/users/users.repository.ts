import { Inject, Injectable } from '@nestjs/common';

import { USER_MODULES } from '@orbit/contracts';

import { isUniqueViolation } from '../../platform/database/prisma-error.mapper';
import { PrismaService } from '../../platform/database/prisma.service';
import type { IdGeneratorPort } from '../../platform/ids/id-generator.port';
import { ID_GENERATOR } from '../../platform/ids/ids.module';

export type AccountSummary = Readonly<{
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION';
}>;

export type CreateAccountInput = Readonly<{ email: string; passwordHash: string; displayName: string }>;

const ACCOUNT_SUMMARY = { id: true, email: true, emailVerifiedAt: true, status: true } as const;

/**
 * Accès aux tables `users` et `user_preferences` (modèles non scopés, DESIGN_PATTERNS.md §3) :
 * seules les opérations de compte passent ici, jamais une lecture de données métier.
 */
@Injectable()
export class UsersRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  findByEmail(email: string): Promise<AccountSummary | null> {
    return this.prisma.user.findFirst({ where: { email }, select: ACCOUNT_SUMMARY });
  }

  /**
   * Crée l'utilisateur et ses préférences par défaut dans une seule instruction (atomique).
   * `null` si l'adresse vient d'être prise par une inscription concurrente.
   */
  async createWithDefaultPreferences(input: CreateAccountInput): Promise<AccountSummary | null> {
    try {
      return await this.prisma.user.create({
        data: {
          id: this.ids.next(),
          email: input.email,
          passwordHash: input.passwordHash,
          displayName: input.displayName,
          preferences: { create: { enabledModules: [...USER_MODULES] } },
        },
        select: ACCOUNT_SUMMARY,
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }
}
