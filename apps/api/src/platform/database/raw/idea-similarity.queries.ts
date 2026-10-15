import { Injectable } from '@nestjs/common';

import type { IdeaStatus } from '@orbit/contracts';

import { TenantContext } from '../../tenant/tenant-context';
import { PrismaService } from '../prisma.service';

export type SimilarIdeaRow = Readonly<{ id: string; title: string; status: IdeaStatus; similarity: number }>;

const MAX_SUGGESTIONS = 3;

/**
 * Idées au titre proche (PHASE-04, suggestion de doublon). SQL brut, seul dossier autorisé (ADR-028) :
 * l'opérateur trigramme `%` (seuil `pg_trgm.similarity_threshold`, 0,3 par défaut) exploite l'index
 * `ix_ideas__title_trgm` sur `f_unaccent(lower(title))`. Le filtre `user_id` vient du contexte de requête.
 */
@Injectable()
export class IdeaSimilarityQueries {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  similarTo(ideaId: string, title: string): Promise<SimilarIdeaRow[]> {
    const userId = this.tenant.requireUserId();
    return this.prisma.$queryRaw<SimilarIdeaRow[]>`
      SELECT id::text AS id, title, status::text AS status,
             similarity(public.f_unaccent(lower(title)), public.f_unaccent(lower(${title})))::float8 AS similarity
        FROM ideas
       WHERE user_id = ${userId}::uuid
         AND id <> ${ideaId}::uuid
         AND deleted_at IS NULL
         AND public.f_unaccent(lower(title)) % public.f_unaccent(lower(${title}))
       ORDER BY similarity DESC, id
       LIMIT ${MAX_SUGGESTIONS}`;
  }
}
