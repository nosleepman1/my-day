import { z } from 'zod';

import {
  CompleteTaskResponseSchema,
  ConvertIdeaResponseSchema,
  IdeaListResponseSchema,
  IdeaResponseSchema,
  NoteLinkResponseSchema,
  NoteListResponseSchema,
  NoteResponseSchema,
  ProjectListResponseSchema,
  ProjectResponseSchema,
  ProjectSummaryResponseSchema,
  SimilarIdeasResponseSchema,
  TagListResponseSchema,
  TagResponseSchema,
  TaskDetailResponseSchema,
  TaskHistoryResponseSchema,
  TaskListResponseSchema,
  TaskResponseSchema,
  type CreateIdeaRequest,
  type IdeaListResponse,
  type NoteListResponse,
  type ProjectListResponse,
  type TaskListResponse,
  type CreateNoteLinkRequest,
  type CreateNoteRequest,
  type CreateProjectRequest,
  type CreateTagRequest,
  type CreateTaskRequest,
  type UpdateIdeaRequest,
  type UpdateNoteRequest,
  type UpdateProjectRequest,
  type UpdateTagRequest,
  type UpdateTaskRequest,
} from '@orbit/contracts';

import { http, type RequestOptions } from '@/lib/http/client';

export type ListParams = Readonly<Record<string, string | undefined>>;
export type Resource = 'ideas' | 'projects' | 'tasks' | 'notes';

/** Chaîne de requête des filtres (API.md §8) : les valeurs absentes ou vides sont omises. */
export function queryString(params: ListParams): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '',
  );
  return entries.length === 0 ? '' : `?${new URLSearchParams(entries).toString()}`;
}

const signalOf = (signal?: AbortSignal): RequestOptions => (signal === undefined ? {} : { signal });
const NoContent = z.undefined();

interface ListResponses {
  ideas: IdeaListResponse;
  projects: ProjectListResponse;
  tasks: TaskListResponse;
  notes: NoteListResponse;
}

const LIST_SCHEMAS: { [R in Resource]: z.ZodType<ListResponses[R]> } = {
  ideas: IdeaListResponseSchema,
  projects: ProjectListResponseSchema,
  tasks: TaskListResponseSchema,
  notes: NoteListResponseSchema,
};

/** Appels de l'API M03 (API.md §14.5) ; chaque réponse est validée par son contrat. */
export const organizationApi = {
  list: <R extends Resource>(
    resource: R,
    params: ListParams,
    signal?: AbortSignal,
  ): Promise<ListResponses[R]> =>
    http(`/${resource}${queryString(params)}`, LIST_SCHEMAS[resource], signalOf(signal)),
  remove: (resource: Resource, id: string, ifMatch?: number) =>
    http(`/${resource}/${id}`, NoContent, {
      method: 'DELETE',
      ...(ifMatch === undefined ? {} : { ifMatch }),
    }),
  setArchived: (resource: 'ideas' | 'projects' | 'notes', id: string, archived: boolean) =>
    http(`/${resource}/${id}/${archived ? 'archive' : 'restore'}`, z.unknown(), { method: 'POST' }),
  setTags: (resource: Resource, id: string, tagIds: readonly string[]) =>
    http(`/${resource}/${id}/tags`, z.unknown(), { method: 'PUT', body: { tagIds } }),

  idea: (id: string, signal?: AbortSignal) => http(`/ideas/${id}`, IdeaResponseSchema, signalOf(signal)),
  createIdea: (body: CreateIdeaRequest) => http('/ideas', IdeaResponseSchema, { method: 'POST', body }),
  updateIdea: (id: string, body: UpdateIdeaRequest, ifMatch?: number) =>
    http(`/ideas/${id}`, IdeaResponseSchema, {
      method: 'PATCH',
      body,
      ...(ifMatch === undefined ? {} : { ifMatch }),
    }),
  convertIdea: (id: string) =>
    http(`/ideas/${id}/convert-to-project`, ConvertIdeaResponseSchema, { method: 'POST' }),
  similarIdeas: (id: string, signal?: AbortSignal) =>
    http(`/ideas/${id}/similar`, SimilarIdeasResponseSchema, signalOf(signal)),

  project: (id: string, signal?: AbortSignal) =>
    http(`/projects/${id}`, ProjectResponseSchema, signalOf(signal)),
  projectSummary: (id: string, signal?: AbortSignal) =>
    http(`/projects/${id}/summary`, ProjectSummaryResponseSchema, signalOf(signal)),
  createProject: (body: CreateProjectRequest) =>
    http('/projects', ProjectResponseSchema, { method: 'POST', body }),
  updateProject: (id: string, body: UpdateProjectRequest, ifMatch?: number) =>
    http(`/projects/${id}`, ProjectResponseSchema, {
      method: 'PATCH',
      body,
      ...(ifMatch === undefined ? {} : { ifMatch }),
    }),

  task: (id: string, signal?: AbortSignal) =>
    http(`/tasks/${id}`, TaskDetailResponseSchema, signalOf(signal)),
  taskHistory: (id: string, signal?: AbortSignal) =>
    http(`/tasks/${id}/history`, TaskHistoryResponseSchema, signalOf(signal)),
  createTask: (body: CreateTaskRequest) => http('/tasks', TaskResponseSchema, { method: 'POST', body }),
  updateTask: (id: string, body: UpdateTaskRequest, ifMatch?: number) =>
    http(`/tasks/${id}`, TaskResponseSchema, {
      method: 'PATCH',
      body,
      ...(ifMatch === undefined ? {} : { ifMatch }),
    }),
  completeTask: (id: string) => http(`/tasks/${id}/complete`, CompleteTaskResponseSchema, { method: 'POST' }),
  reopenTask: (id: string) => http(`/tasks/${id}/reopen`, TaskResponseSchema, { method: 'POST' }),
  addDependency: (id: string, dependsOnTaskId: string) =>
    http(`/tasks/${id}/dependencies`, TaskDetailResponseSchema, {
      method: 'POST',
      body: { dependsOnTaskId },
    }),
  removeDependency: (id: string, dependsOnTaskId: string) =>
    http(`/tasks/${id}/dependencies/${dependsOnTaskId}`, NoContent, { method: 'DELETE' }),

  note: (id: string, signal?: AbortSignal) => http(`/notes/${id}`, NoteResponseSchema, signalOf(signal)),
  createNote: (body: CreateNoteRequest) => http('/notes', NoteResponseSchema, { method: 'POST', body }),
  updateNote: (id: string, body: UpdateNoteRequest, ifMatch: number) =>
    http(`/notes/${id}`, NoteResponseSchema, { method: 'PATCH', body, ifMatch }),
  linkNote: (id: string, body: CreateNoteLinkRequest) =>
    http(`/notes/${id}/links`, NoteLinkResponseSchema, { method: 'POST', body }),
  unlinkNote: (id: string, linkId: string) =>
    http(`/notes/${id}/links/${linkId}`, NoContent, { method: 'DELETE' }),

  tags: (signal?: AbortSignal) => http('/tags', TagListResponseSchema, signalOf(signal)),
  createTag: (body: CreateTagRequest) => http('/tags', TagResponseSchema, { method: 'POST', body }),
  updateTag: (id: string, body: UpdateTagRequest) =>
    http(`/tags/${id}`, TagResponseSchema, { method: 'PATCH', body }),
  removeTag: (id: string) => http(`/tags/${id}`, NoContent, { method: 'DELETE' }),
  mergeTag: (id: string, targetTagId: string) =>
    http(`/tags/${id}/merge`, TagResponseSchema, { method: 'POST', body: { targetTagId } }),
};
