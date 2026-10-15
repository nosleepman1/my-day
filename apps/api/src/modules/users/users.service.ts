import { Inject, Injectable } from '@nestjs/common';

import type { UpdatePreferencesRequest } from '@orbit/contracts';

import { DomainError } from '../../platform/errors/domain-error';
import { defaultMessageOf } from '../../platform/http/error-mapping';
import { CLOCK, type ClockPort } from '../../platform/time/clock.port';

import { type PreferencesRecord, PreferencesRepository } from './preferences.repository';
import type { ProfileRecord } from './session-user';
import {
  type AccountSummary,
  type CreateAccountInput,
  type UserCredentials,
  UsersRepository,
} from './users.repository';

/** Façade publique des comptes, utilisée par `modules/auth` (ARCHITECTURE.md §5.2, arête auth → users). */
export interface AccountDirectory {
  findAccountByEmail(email: string): Promise<AccountSummary | null>;
  createAccount(input: CreateAccountInput): Promise<AccountSummary | null>;
}

/** Marquage de l'adresse vérifiée, utilisé par la vérification d'e-mail de `modules/auth`. */
export interface EmailVerificationTarget {
  markEmailVerified(userId: string, email: string, at: Date): Promise<boolean>;
}

/** Lecture des identifiants et suivi des connexions, utilisés par la connexion de `modules/auth`. */
export interface CredentialDirectory {
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  recordSuccessfulLogin(userId: string, at: Date, newPasswordHash: string | null): Promise<void>;
}

export interface AccountLookup {
  findAccountById(id: string): Promise<AccountSummary | null>;
}

export interface CredentialLookup {
  findCredentialsById(id: string): Promise<UserCredentials | null>;
}

/** Changement d'adresse e-mail, piloté par `modules/auth` (SECURITY.md §3.6). */
export interface EmailChangeAccounts extends AccountLookup {
  findAccountByEmail(email: string): Promise<AccountSummary | null>;
  changeEmail(userId: string, email: string, at: Date): Promise<boolean>;
}

export interface PasswordStore {
  updatePasswordHash(userId: string, passwordHash: string, at: Date): Promise<void>;
}

@Injectable()
export class UsersService
  implements
    AccountDirectory,
    EmailVerificationTarget,
    CredentialDirectory,
    AccountLookup,
    CredentialLookup,
    PasswordStore,
    EmailChangeAccounts
{
  constructor(
    private readonly users: UsersRepository,
    private readonly preferences: PreferencesRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  /** @throws {DomainError} NOT_FOUND si le compte a disparu entre-temps. */
  async requireProfile(userId: string): Promise<ProfileRecord> {
    const profile = await this.users.findProfile(userId);
    if (profile === null) throw new DomainError('NOT_FOUND', defaultMessageOf('NOT_FOUND'));
    return profile;
  }

  async updateDisplayName(userId: string, displayName: string): Promise<ProfileRecord> {
    await this.users.updateDisplayName(userId, displayName);
    return this.requireProfile(userId);
  }

  /** Préférences de l'utilisateur courant (client cloisonné, contexte CLS). */
  async requirePreferences(): Promise<PreferencesRecord> {
    const preferences = await this.preferences.find();
    if (preferences === null) throw new DomainError('NOT_FOUND', defaultMessageOf('NOT_FOUND'));
    return preferences;
  }

  async updatePreferences(request: UpdatePreferencesRequest): Promise<PreferencesRecord> {
    const { onboardingCompleted, ...fields } = request;
    const patch =
      onboardingCompleted === true ? { ...fields, onboardingCompletedAt: this.clock.now() } : fields;
    const updated = await this.preferences.update(patch);
    if (updated === null) throw new DomainError('NOT_FOUND', defaultMessageOf('NOT_FOUND'));
    return updated;
  }

  changeEmail(userId: string, email: string, at: Date): Promise<boolean> {
    return this.users.changeEmail(userId, email, at);
  }

  /** L'adresse doit déjà être normalisée par l'appelant. */
  findAccountByEmail(email: string): Promise<AccountSummary | null> {
    return this.users.findByEmail(email);
  }

  /** Utilisateur et préférences par défaut (fuseau Africa/Dakar, XOF, fr, tous les modules utilisateur). */
  createAccount(input: CreateAccountInput): Promise<AccountSummary | null> {
    return this.users.createWithDefaultPreferences(input);
  }

  /** Seulement si le compte a toujours cette adresse et qu'elle n'est pas déjà vérifiée. */
  markEmailVerified(userId: string, email: string, at: Date): Promise<boolean> {
    return this.users.markEmailVerified(userId, email, at);
  }

  /** L'adresse doit déjà être normalisée par l'appelant. */
  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.users.findCredentialsByEmail(email);
  }

  recordSuccessfulLogin(userId: string, at: Date, newPasswordHash: string | null): Promise<void> {
    return this.users.recordSuccessfulLogin(userId, at, newPasswordHash);
  }

  findAccountById(id: string): Promise<AccountSummary | null> {
    return this.users.findAccountById(id);
  }

  findCredentialsById(id: string): Promise<UserCredentials | null> {
    return this.users.findCredentialsById(id);
  }

  /** Met aussi à jour `password_changed_at`. */
  updatePasswordHash(userId: string, passwordHash: string, at: Date): Promise<void> {
    return this.users.updatePasswordHash(userId, passwordHash, at);
  }
}
