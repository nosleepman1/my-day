import { Inject, Injectable } from '@nestjs/common';

import { normalizeEmail } from '@orbit/contracts';

import { PASSWORD_HASHER, type PasswordHasherPort } from '../../platform/auth/password-hasher.port';
import { checkPasswordPolicy } from '../../platform/auth/password-policy';
import { CLOCK, type ClockPort } from '../../platform/time/clock.port';

import { UsersRepository } from './users.repository';

export type ProvisionResult = 'created' | 'promoted' | 'unchanged';

export type ProvisionRequest = Readonly<{
  email: string;
  /** Lu seulement si un compte doit être créé (saisie interactive ou génération). */
  password: () => Promise<string>;
  /** Transfère le rôle si un autre ADMIN existe (index `ux_users__single_admin`). */
  force: boolean;
}>;

/** Refus explicite, affiché tel quel par la CLI (aucune donnée sensible dans le message). */
export class AdminProvisioningError extends Error {
  override readonly name = 'AdminProvisioningError';
}

/**
 * `pnpm --filter @orbit/api cli create-admin` (PHASE-01) : un seul ADMIN (ADR-002), compte vérifié d'emblée.
 * Idempotent : une adresse déjà ADMIN ne change pas.
 */
@Injectable()
export class AdminProvisioningService {
  constructor(
    private readonly users: UsersRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async provision(request: ProvisionRequest): Promise<ProvisionResult> {
    const email = normalizeEmail(request.email);
    const existing = await this.users.findCredentialsByEmail(email);
    if (existing?.role === 'ADMIN') return 'unchanged';
    const currentAdmin = await this.users.findAdmin();
    if (currentAdmin !== null && !request.force) {
      throw new AdminProvisioningError(
        'Un autre compte ADMIN existe déjà : relancer avec --force pour lui retirer le rôle.',
      );
    }
    const demoteId = currentAdmin?.id ?? null;
    const at = this.clock.now();
    if (existing !== null) {
      await this.users.transferAdmin(demoteId, existing.id, at);
      return 'promoted';
    }
    const password = await request.password();
    const violations = checkPasswordPolicy(password, email);
    if (violations.length > 0) {
      throw new AdminProvisioningError(`Mot de passe refusé par la politique : ${violations.join(', ')}.`);
    }
    const passwordHash = await this.hasher.hash(password);
    await this.users.createAdmin(
      { email, passwordHash, displayName: email.split('@')[0] ?? email },
      demoteId,
      at,
    );
    return 'created';
  }
}
