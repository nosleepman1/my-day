import { Inject, Injectable } from '@nestjs/common';

import { USER_MODULES } from '@orbit/contracts';

import { isUniqueViolation } from '../../platform/database/prisma-error.mapper';
import { PrismaService } from '../../platform/database/prisma.service';
import type { IdGeneratorPort } from '../../platform/ids/id-generator.port';
import { ID_GENERATOR } from '../../platform/ids/ids.module';

import type { ProfileRecord } from './session-user';

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
const PROFILE = { id: true, email: true, displayName: true, role: true, emailVerifiedAt: true } as const;
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

  findAccountById(id: string): Promise<AccountSummary | null> {
    return this.prisma.user.findFirst({ where: { id }, select: ACCOUNT_SUMMARY });
  }

  findCredentialsById(id: string): Promise<UserCredentials | null> {
    return this.prisma.user.findFirst({ where: { id }, select: CREDENTIALS });
  }

  findProfile(id: string): Promise<ProfileRecord | null> {
    return this.prisma.user.findFirst({ where: { id }, select: PROFILE });
  }

  async updateDisplayName(id: string, displayName: string): Promise<void> {
    await this.prisma.user.updateMany({ where: { id }, data: { displayName } });
  }

  /** Nouvelle adresse vérifiée par le lien reçu ; `false` si elle a été prise entre-temps. */
  async changeEmail(id: string, email: string, at: Date): Promise<boolean> {
    try {
      const { count } = await this.prisma.user.updateMany({
        where: { id },
        data: { email, emailVerifiedAt: at },
      });
      return count === 1;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  findAdmin(): Promise<{ id: string; email: string } | null> {
    return this.prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true, email: true } });
  }

  /** ADMIN vérifié d'emblée ; l'ADMIN précédent éventuel est rétrogradé dans la même transaction (ADR-002). */
  async createAdmin(input: CreateAccountInput, demoteId: string | null, at: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (demoteId !== null) await tx.user.updateMany({ where: { id: demoteId }, data: { role: 'USER' } });
      await tx.user.create({
        data: {
          id: this.ids.next(),
          email: input.email,
          passwordHash: input.passwordHash,
          displayName: input.displayName,
          role: 'ADMIN',
          emailVerifiedAt: at,
          preferences: { create: { enabledModules: [...USER_MODULES] } },
        },
      });
    });
  }

  /** Rétrograde l'ADMIN courant puis promeut le compte ciblé : l'index `ux_users__single_admin` reste respecté. */
  async transferAdmin(demoteId: string | null, promoteId: string, at: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (demoteId !== null) await tx.user.updateMany({ where: { id: demoteId }, data: { role: 'USER' } });
      await tx.user.updateMany({ where: { id: promoteId }, data: { role: 'ADMIN' } });
      await tx.user.updateMany({
        where: { id: promoteId, emailVerifiedAt: null },
        data: { emailVerifiedAt: at },
      });
    });
  }

  async updatePasswordHash(id: string, passwordHash: string, at: Date): Promise<void> {
    await this.prisma.user.updateMany({ where: { id }, data: { passwordHash, passwordChangedAt: at } });
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
