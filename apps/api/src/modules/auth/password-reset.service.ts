import { Inject, Injectable } from '@nestjs/common';

import { hashOpaqueToken } from '../../platform/auth/session-token';
import { DomainError } from '../../platform/errors/domain-error';
import type { ClientContext } from '../../platform/http/client-context';
import { defaultMessageOf } from '../../platform/http/error-mapping';
import { type AccountLookup, UsersService } from '../users';

import { PasswordChanger } from './password-changer.service';
import { PasswordResetTokensRepository, type ResetTokenStore } from './password-reset-tokens.repository';
import { SecurityNotices } from './security-notices.service';

const NEW_PASSWORD_FIELD = 'newPassword';

function gone(): DomainError {
  return new DomainError('GONE', defaultMessageOf('GONE'));
}

/**
 * `POST /auth/password/reset` (SECURITY.md §3.5) : la politique est vérifiée avant de consommer le jeton
 * (une faute de frappe ne brûle pas le lien), puis consommation atomique, invalidation des autres jetons,
 * nouveau mot de passe, révocation de toutes les sessions et notification. Ne connecte pas l'utilisateur.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(PasswordResetTokensRepository) private readonly tokens: ResetTokenStore,
    @Inject(UsersService) private readonly accounts: AccountLookup,
    private readonly changer: PasswordChanger,
    private readonly notices: SecurityNotices,
  ) {}

  /** @throws {DomainError} GONE (jeton inconnu, consommé, expiré ou compte inactif) ou VALIDATION_FAILED. */
  async reset(token: string, newPassword: string, client: ClientContext): Promise<void> {
    const now = this.notices.now();
    const stored = await this.tokens.findByHash(hashOpaqueToken(token));
    if (stored?.consumedAt !== null || stored.expiresAt.getTime() <= now.getTime()) throw gone();
    const account = await this.accounts.findAccountById(stored.userId);
    if (account?.status !== 'ACTIVE') throw gone();
    const passwordHash = await this.changer.hashNewPassword(account, newPassword, NEW_PASSWORD_FIELD);
    if (!(await this.tokens.consume(stored.id, now))) throw gone();
    await this.tokens.invalidateAll(account.id, now);
    await this.changer.commit(account, passwordHash, {
      eventType: 'PASSWORD_RESET_COMPLETED',
      keepSessionId: null,
      client,
      field: NEW_PASSWORD_FIELD,
    });
  }
}
