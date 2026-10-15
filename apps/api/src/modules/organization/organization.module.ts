import { Module } from '@nestjs/common';

import { IdeaConversionService } from './ideas/idea-conversion.service';
import { IdeasController } from './ideas/ideas.controller';
import { IdeasService } from './ideas/ideas.service';
import { NoteLinksService } from './notes/note-links.service';
import { NotesController } from './notes/notes.controller';
import { NotesService } from './notes/notes.service';
import { ProjectsController } from './projects/projects.controller';
import { ProjectsService } from './projects/projects.service';
import { OrganizationContext } from './shared/organization-context';
import { UserCalendarService } from './shared/user-calendar.service';
import { TagsController } from './tags/tags.controller';
import { TagsService } from './tags/tags.service';
import { TaskCompletionService } from './tasks/task-completion.service';
import { TaskReferences } from './tasks/task-references';
import { TaskRelationsService } from './tasks/task-relations.service';
import { TasksController } from './tasks/tasks.controller';
import { TasksService } from './tasks/tasks.service';

/** M03 Organisation (PHASE-04) : idées, projets, tâches, tags, notes ; données cloisonnées par utilisateur. */
@Module({
  controllers: [TagsController, IdeasController, ProjectsController, TasksController, NotesController],
  providers: [
    OrganizationContext,
    UserCalendarService,
    TagsService,
    IdeasService,
    IdeaConversionService,
    ProjectsService,
    TasksService,
    TaskReferences,
    TaskCompletionService,
    TaskRelationsService,
    NotesService,
    NoteLinksService,
  ],
})
export class OrganizationModule {}
