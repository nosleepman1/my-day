import { Inject, Injectable } from '@nestjs/common';

import { type ScopedPrismaClient, TENANT_PRISMA } from '../../platform/database/scoped-prisma';

export type PreferencesRecord = Readonly<{
  locale: string;
  timezone: string;
  defaultCurrency: string;
  dateFormat: string;
  weekStartsOn: number;
  theme: 'SYSTEM' | 'LIGHT' | 'DARK';
  enabledModules: string[];
  onboardingCompletedAt: Date | null;
}>;

export type PreferencesUpdate = Partial<Omit<PreferencesRecord, 'onboardingCompletedAt'>> &
  Readonly<{ onboardingCompletedAt?: Date }>;

const PREFERENCES_SELECT = {
  locale: true,
  timezone: true,
  defaultCurrency: true,
  dateFormat: true,
  weekStartsOn: true,
  theme: true,
  enabledModules: true,
  onboardingCompletedAt: true,
} as const;

/** `user_preferences` par le client cloisonné : l'utilisateur courant vient du contexte (ADR-007-3). */
@Injectable()
export class PreferencesRepository {
  constructor(@Inject(TENANT_PRISMA) private readonly db: ScopedPrismaClient) {}

  find(): Promise<PreferencesRecord | null> {
    return this.db.userPreference.findFirst({ select: PREFERENCES_SELECT });
  }

  async update(patch: PreferencesUpdate): Promise<PreferencesRecord | null> {
    await this.db.userPreference.updateMany({ data: patch });
    return this.find();
  }
}
