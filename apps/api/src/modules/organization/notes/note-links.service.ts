import { Injectable } from '@nestjs/common';

import type { CreateNoteLinkRequest, NoteLink } from '@orbit/contracts';

import { isUniqueViolation } from '../../../platform/database/prisma-error.mapper';
import { OrganizationContext } from '../shared/organization-context';
import { notFound } from '../shared/versioning';

import { NOTE_LINK_SELECT, toNoteLink } from './note-records';
import { NotesService } from './notes.service';

/**
 * Liens explicites d'une note (ADR-018) : une ligne par cible. Une cible absente, supprimée ou d'un autre
 * utilisateur donne 404 ; la FK composite `(user_id, cible)` l'interdit aussi en base. Relier deux fois la
 * même cible renvoie le lien existant.
 */
@Injectable()
export class NoteLinksService {
  constructor(
    private readonly ctx: OrganizationContext,
    private readonly notes: NotesService,
  ) {}

  async create(noteId: string, target: CreateNoteLinkRequest): Promise<NoteLink> {
    await this.notes.require(noteId);
    await this.assertTargetExists(target);
    const where = { noteId, ...target };
    try {
      await this.ctx.db.noteLink.create({
        data: { id: this.ctx.newId(), userId: this.ctx.userId(), ...where },
        select: { id: true },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    const link = await this.ctx.db.noteLink.findFirst({ where, select: NOTE_LINK_SELECT });
    const mapped = link === null ? null : toNoteLink(link);
    if (mapped === null) throw notFound();
    return mapped;
  }

  async remove(noteId: string, linkId: string): Promise<void> {
    const { count } = await this.ctx.db.noteLink.deleteMany({ where: { id: linkId, noteId } });
    if (count === 0) throw notFound();
  }

  private async assertTargetExists(target: CreateNoteLinkRequest): Promise<void> {
    const live = { deletedAt: null };
    const found =
      target.ideaId !== undefined
        ? await this.ctx.db.idea.count({ where: { id: target.ideaId, ...live } })
        : target.projectId !== undefined
          ? await this.ctx.db.project.count({ where: { id: target.projectId, ...live } })
          : await this.ctx.db.task.count({ where: { id: target.taskId ?? '', ...live } });
    if (found === 0) throw notFound();
  }
}
