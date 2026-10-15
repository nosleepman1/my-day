import { Injectable } from '@nestjs/common';

import type { ConvertIdeaResponse } from '@orbit/contracts';

import { AuditService } from '../../../platform/audit/audit.service';
import { isUniqueViolation } from '../../../platform/database/prisma-error.mapper';
import { DomainError } from '../../../platform/errors/domain-error';
import { CONVERTIBLE_IDEA_STATUSES } from '../domain/idea-status';
import { slugify } from '../domain/slug';
import { freeSlug } from '../projects/project-records';
import { ProjectsService } from '../projects/projects.service';
import { OrganizationContext } from '../shared/organization-context';
import { copyTags } from '../shared/tag-links';

import type { IdeaRow } from './idea-records';
import { IdeasService } from './ideas.service';

const PROJECT_NAME_MAX = 120;

/** Une autre requête a converti l'idée pendant la transaction : on renvoie son projet. */
class AlreadyConverted extends Error {
  override readonly name = 'AlreadyConverted';
}

function notConvertible(): DomainError {
  return new DomainError('CONFLICT', 'Cette idée ne peut pas être convertie (archivée ou abandonnée).', {
    rule: 'IDEA_NOT_CONVERTIBLE',
  });
}

/**
 * `POST /ideas/:id/convert-to-project` (PHASE-04 T6) : crée un projet repris de l'idée (nom, description,
 * priorité, tags), relie l'idée (`converted_project_id`) et la passe `IN_PROGRESS`, atomiquement.
 * Idempotent : une idée déjà convertie renvoie son projet. Sous concurrence, la mise à jour conditionnelle
 * de l'idée ne laisse gagner qu'une transaction ; la perdante est annulée avec son projet.
 */
@Injectable()
export class IdeaConversionService {
  constructor(
    private readonly ctx: OrganizationContext,
    private readonly ideas: IdeasService,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
  ) {}

  async convert(id: string): Promise<ConvertIdeaResponse['data']> {
    const idea = await this.ideas.require(id);
    const existing = await this.existingConversion(idea);
    if (existing !== null) return existing;
    if (idea.archivedAt !== null || !CONVERTIBLE_IDEA_STATUSES.includes(idea.status)) throw notConvertible();
    let projectId: string;
    try {
      projectId = await this.createProject(idea);
    } catch (error) {
      // La conversion concurrente peut aussi se trahir par le même slug (`ux_projects__slug`, P2002).
      if (!(error instanceof AlreadyConverted) && !isUniqueViolation(error)) throw error;
      const winner = await this.existingConversion(await this.ideas.require(id));
      if (winner === null) throw error;
      return winner;
    }
    await this.audit.record({
      action: 'organization.idea.convert',
      userId: this.ctx.userId(),
      entityType: 'idea',
      entityId: id,
      metadata: { projectId },
    });
    return { idea: await this.ideas.get(id), project: await this.projects.get(projectId), created: true };
  }

  private async existingConversion(idea: IdeaRow): Promise<ConvertIdeaResponse['data'] | null> {
    if (idea.convertedProjectId === null) return null;
    const project = await this.projects.find(idea.convertedProjectId);
    if (project === null) return null;
    return {
      idea: await this.ideas.get(idea.id),
      project: await this.projects.get(project.id),
      created: false,
    };
  }

  private createProject(idea: IdeaRow): Promise<string> {
    const userId = this.ctx.userId();
    return this.ctx.db.$transaction(async (tx) => {
      const projectId = this.ctx.newId();
      await tx.project.create({
        data: {
          id: projectId,
          userId,
          name: idea.title.slice(0, PROJECT_NAME_MAX),
          slug: await freeSlug(tx, slugify(idea.title)),
          description: idea.description,
          priority: idea.priority,
          status: 'PLANNED',
        },
        select: { id: true },
      });
      const tagIds = idea.tags.map((tag) => tag.tagId);
      await copyTags(tx, { userId, kind: 'project', entityId: projectId }, tagIds);
      const { count } = await tx.idea.updateMany({
        where: { id: idea.id, deletedAt: null, convertedProjectId: idea.convertedProjectId },
        data: { convertedProjectId: projectId, status: 'IN_PROGRESS', version: { increment: 1 } },
      });
      if (count === 0) throw new AlreadyConverted();
      return projectId;
    });
  }
}
