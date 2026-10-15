import { Inject, Injectable } from '@nestjs/common';

import { PASSWORD_HASHER, type PasswordHasherPort } from '../../platform/auth/password-hasher.port';
import { checkPasswordPolicy, type PasswordViolation } from '../../platform/auth/password-policy';
import { DomainError } from '../../platform/errors/domain-error';
import type { ClientContext } from '../../platform/http/client-context';
import { defaultMessageOf } from '../../platform/http/error-mapping';
import { type PasswordStore, UsersService } from '../users';

import { type AccountRef, SecurityNotices } from './security-notices.service';
import type { SessionRevokeReason } from './sessions.repository';
import { SessionsService } from './sessions.service';

const POLICY_MESSAGES: Readonly<Record<PasswordViolation, string>> = {
  TOO_SHORT: 'Le mot de passe doit contenir au moins 12 caractères.',
  TOO_LONG: 'Le mot de passe ne peut pas dépasser 128 caractères.',
  COMMON: 'Ce mot de passe est trop courant.',
  CONTAINS_EMAIL: 'Le mot de passe ne doit pas contenir votre adresse e-mail.',
};

/** Politique SECURITY.md §3.3 ; une violation devient `VALIDATION_FAILED` sur le champ indiqué. */
export function assertPasswordPolicy(password: string, email: string, field: string): void {
  const violations = checkPasswordPolicy(password, email);
  if (violations.length === 0) return;
  throw new DomainError(
    'VALIDATION_FAILED',
    defaultMessageOf('VALIDATION_FAILED'),
    violations.map((code) => ({ path: [field], code, message: POLICY_MESSAGES[code] })),
  );
}

interface SessionRevoker {
  revokeAllForUser(
    userId: string,
    reason: SessionRevokeReason,
    exceptSessionId: string | null,
  ): Promise<void>;
}

export type PasswordChange = Readonly<{
  eventType: 'PASSWORD_CHANGED' | 'PASSWORD_RESET_COMPLETED';
  /** Session conservée (changement depuis le profil) ; `null` : toutes les sessions sont révoquées. */
  keepSessionId: string | null;
  client: ClientContext;
  field: string;
}>;

/** Remplacement du mot de passe : réinitialisation (T9) et changement depuis le profil (T10). */
@Injectable()
export class PasswordChanger {
  constructor(
    @Inject(UsersService) private readonly accounts: PasswordStore,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(SessionsService) private readonly sessions: SessionRevoker,
    private readonly notices: SecurityNotices,
  ) {}

  async change(account: AccountRef, newPassword: string, change: PasswordChange): Promise<void> {
    await this.commit(account, await this.hashNewPassword(account, newPassword, change.field), change);
  }

  /** Politique puis hachage : à faire avant toute consommation de jeton (un 503 ne brûle pas le lien). */
  async hashNewPassword(account: AccountRef, newPassword: string, field: string): Promise<string> {
    assertPasswordPolicy(newPassword, account.email, field);
    return this.hasher.hash(newPassword);
  }

  async commit(account: AccountRef, passwordHash: string, change: PasswordChange): Promise<void> {
    await this.accounts.updatePasswordHash(account.id, passwordHash, this.notices.now());
    await this.sessions.revokeAllForUser(account.id, 'PASSWORD_CHANGED', change.keepSessionId);
    await this.notices.passwordChanged(account, change.eventType, change.client, change.keepSessionId);
  }
}
