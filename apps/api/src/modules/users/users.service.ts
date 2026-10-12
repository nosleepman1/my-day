import { Injectable } from '@nestjs/common';

import { type AccountSummary, type CreateAccountInput, UsersRepository } from './users.repository';

/** Façade publique des comptes, utilisée par `modules/auth` (ARCHITECTURE.md §5.2, arête auth → users). */
export interface AccountDirectory {
  findAccountByEmail(email: string): Promise<AccountSummary | null>;
  createAccount(input: CreateAccountInput): Promise<AccountSummary | null>;
}

/** Marquage de l'adresse vérifiée, utilisé par la vérification d'e-mail de `modules/auth`. */
export interface EmailVerificationTarget {
  markEmailVerified(userId: string, email: string, at: Date): Promise<boolean>;
}

@Injectable()
export class UsersService implements AccountDirectory, EmailVerificationTarget {
  constructor(private readonly users: UsersRepository) {}

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
}
