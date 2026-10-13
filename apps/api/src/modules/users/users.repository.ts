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

/** Données nécessaires à la connexion ; ne sortent jamais du module auth. */
export type UserCredentials = AccountSummary &
  Readonly<{ displayName: string; passwordHash: string; role: 'USER' | 'ADMIN' }>;

const ACCOUNT_SUMMARY = { id: true, email: true, emailVerifiedAt: true, status: true } as const;
const CREDENTIALS = { ...ACCOUNT_SUMMARY, displayName: true, passwordHash: true, role: true } as const;

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

  /** `false` si le compte n'a plus cette adresse ou si elle est déjà vérifiée. */
  async markEmailVerified(userId: string, email: string, at: Date): Promise<boolean> {
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, email, emailVerifiedAt: null },
      data: { emailVerifiedAt: at },
    });
    return count === 1;
  }

  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.prisma.user.findFirst({ where: { email }, select: CREDENTIALS });
  }

  /** `last_login_at` et, si les paramètres argon2id ont changé, la nouvelle empreinte. */
  async recordSuccessfulLogin(userId: string, at: Date, newPasswordHash: string | null): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId },
      data:
        newPasswordHash === null ? { lastLoginAt: at } : { lastLoginAt: at, passwordHash: newPasswordHash },
    });
  }
}
