import { createZodDto } from 'nestjs-zod';

import {
  AddTaskDependencyRequestSchema,
  CompleteTaskResponseSchema,
  ConvertIdeaResponseSchema,
  CreateIdeaRequestSchema,
  CreateNoteLinkRequestSchema,
  CreateNoteRequestSchema,
  CreateProjectRequestSchema,
  CreateTagRequestSchema,
  CreateTaskRequestSchema,
  IdeaListQuerySchema,
  IdeaListResponseSchema,
  IdeaResponseSchema,
  IdParamSchema,
  MergeTagRequestSchema,
  NoteLinkParamSchema,
  NoteLinkResponseSchema,
  NoteListQuerySchema,
  NoteListResponseSchema,
  NoteResponseSchema,
  ProjectListQuerySchema,
  ProjectListResponseSchema,
  ProjectResponseSchema,
  ProjectSummaryResponseSchema,
  SetTagsRequestSchema,
  SimilarIdeasResponseSchema,
  TagListResponseSchema,
  TagResponseSchema,
  TaskDependencyParamSchema,
  TaskDetailResponseSchema,
  TaskHistoryResponseSchema,
  TaskListQuerySchema,
  TaskListResponseSchema,
  TaskResponseSchema,
  UpdateIdeaRequestSchema,
  UpdateNoteRequestSchema,
  UpdateProjectRequestSchema,
  UpdateTagRequestSchema,
  UpdateTaskRequestSchema,
} from '@orbit/contracts';

/** DTO NestJS des contrats M03 (`@orbit/contracts`) : validation des entrées, filtrage des réponses. */

export class IdParamDto extends createZodDto(IdParamSchema) {}
export class SetTagsRequestDto extends createZodDto(SetTagsRequestSchema) {}

export class TagListResponseDto extends createZodDto(TagListResponseSchema) {}
export class TagResponseDto extends createZodDto(TagResponseSchema) {}
export class CreateTagRequestDto extends createZodDto(CreateTagRequestSchema) {}
export class UpdateTagRequestDto extends createZodDto(UpdateTagRequestSchema) {}
export class MergeTagRequestDto extends createZodDto(MergeTagRequestSchema) {}

export class IdeaListQueryDto extends createZodDto(IdeaListQuerySchema) {}
export class IdeaListResponseDto extends createZodDto(IdeaListResponseSchema) {}
export class IdeaResponseDto extends createZodDto(IdeaResponseSchema) {}
export class CreateIdeaRequestDto extends createZodDto(CreateIdeaRequestSchema) {}
export class UpdateIdeaRequestDto extends createZodDto(UpdateIdeaRequestSchema) {}
export class SimilarIdeasResponseDto extends createZodDto(SimilarIdeasResponseSchema) {}
export class ConvertIdeaResponseDto extends createZodDto(ConvertIdeaResponseSchema) {}

export class ProjectListQueryDto extends createZodDto(ProjectListQuerySchema) {}
export class ProjectListResponseDto extends createZodDto(ProjectListResponseSchema) {}
export class ProjectResponseDto extends createZodDto(ProjectResponseSchema) {}
export class CreateProjectRequestDto extends createZodDto(CreateProjectRequestSchema) {}
export class UpdateProjectRequestDto extends createZodDto(UpdateProjectRequestSchema) {}
export class ProjectSummaryResponseDto extends createZodDto(ProjectSummaryResponseSchema) {}

export class TaskListQueryDto extends createZodDto(TaskListQuerySchema) {}
export class TaskListResponseDto extends createZodDto(TaskListResponseSchema) {}
export class TaskResponseDto extends createZodDto(TaskResponseSchema) {}
export class TaskDetailResponseDto extends createZodDto(TaskDetailResponseSchema) {}
export class CreateTaskRequestDto extends createZodDto(CreateTaskRequestSchema) {}
export class UpdateTaskRequestDto extends createZodDto(UpdateTaskRequestSchema) {}
export class CompleteTaskResponseDto extends createZodDto(CompleteTaskResponseSchema) {}
export class TaskHistoryResponseDto extends createZodDto(TaskHistoryResponseSchema) {}
export class AddTaskDependencyRequestDto extends createZodDto(AddTaskDependencyRequestSchema) {}
export class TaskDependencyParamDto extends createZodDto(TaskDependencyParamSchema) {}

export class NoteListQueryDto extends createZodDto(NoteListQuerySchema) {}
export class NoteListResponseDto extends createZodDto(NoteListResponseSchema) {}
export class NoteResponseDto extends createZodDto(NoteResponseSchema) {}
export class CreateNoteRequestDto extends createZodDto(CreateNoteRequestSchema) {}
export class UpdateNoteRequestDto extends createZodDto(UpdateNoteRequestSchema) {}
export class CreateNoteLinkRequestDto extends createZodDto(CreateNoteLinkRequestSchema) {}
export class NoteLinkResponseDto extends createZodDto(NoteLinkResponseSchema) {}
export class NoteLinkParamDto extends createZodDto(NoteLinkParamSchema) {}
