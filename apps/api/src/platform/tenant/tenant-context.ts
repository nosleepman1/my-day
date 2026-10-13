import { Injectable } from '@nestjs/common';
import { ClsService, type ClsStore } from 'nestjs-cls';

import type { AuthenticatedSession, UserRole } from '../auth/session-resolver.port';

/** Contexte de requête (ADR-007-2) : l'identifiant CLS est le `requestId` (API.md §12). */
export interface OrbitClsStore extends ClsStore {
  userId?: string;
  role?: UserRole;
  sessionId?: string;
}

/** Accès aux données sans utilisateur courant : erreur de programmation, jamais une réponse 4xx. */
export class MissingTenantContextError extends Error {
  override readonly name = 'MissingTenantContextError';

  constructor() {
    super('No tenant context: data access requires an authenticated request or runAsUser()');
  }
}

/** Utilisateur courant de la requête ou du job, lu dans nestjs-cls. */
@Injectable()
export class TenantContext {
  constructor(private readonly cls: ClsService<OrbitClsStore>) {}

  userId(): string | undefined {
    return this.cls.isActive() ? this.cls.get('userId') : undefined;
  }

  role(): UserRole | undefined {
    return this.cls.isActive() ? this.cls.get('role') : undefined;
  }

  /** @throws {MissingTenantContextError} hors d'une requête authentifiée ou d'un `runAsUser`. */
  requireUserId(): string {
    const userId = this.userId();
    if (userId === undefined) throw new MissingTenantContextError();
    return userId;
  }

  /** Appelé par le guard global une fois la session validée. */
  attachSession(session: AuthenticatedSession): void {
    if (!this.cls.isActive()) throw new MissingTenantContextError();
    this.cls.set('userId', session.userId);
    this.cls.set('role', session.role);
    this.cls.set('sessionId', session.sessionId);
  }

  /**
   * Rejoue le contexte d'un utilisateur hors requête HTTP : jobs, webhooks, CLI (ADR-007-8).
   * La tâche est attendue à l'intérieur du contexte : une requête Prisma est paresseuse et ne s'exécute
   * qu'au premier `then()`, qui doit donc avoir lieu avant la sortie du contexte.
   */
  runAsUser<T>(userId: string, role: UserRole, task: () => PromiseLike<T>): Promise<T> {
    return this.cls.run(async () => {
      this.cls.set('userId', userId);
      this.cls.set('role', role);
      const result = await task();
      return result;
    });
  }
}
