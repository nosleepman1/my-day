import { http, HttpResponse } from 'msw';

import type { Idea, Note, Project, ProjectSummary, Tag, Task, TaskDetail } from '@orbit/contracts';

/** Données synthétiques M03 conformes aux contrats (aucune donnée réelle). */
export const NOW = '2026-10-14T10:00:00.000Z';
export const ID = (n: number): string => `0192f3a4-5b6c-7d8e-9f01-0000000000${String(n).padStart(2, '0')}`;

export const page = <T>(data: T[]) => ({ data, meta: { limit: 25, nextCursor: null, hasMore: false } });

export function idea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: ID(1),
    title: 'Boutique de wax en ligne',
    description: null,
    status: 'INBOX',
    priority: null,
    domain: null,
    potentialScore: null,
    decisionNote: null,
    capturedAt: NOW,
    source: 'MANUAL',
    convertedProjectId: null,
    tagIds: [],
    version: 1,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function project(overrides: Partial<Project> = {}): Project {
  return {
    id: ID(5),
    name: 'Site vitrine',
    slug: 'site-vitrine',
    description: null,
    type: 'FREELANCE',
    status: 'ACTIVE',
    priority: null,
    startsOn: null,
    targetOn: '2026-12-01',
    completedOn: null,
    color: null,
    tagIds: [],
    version: 1,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function summary(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    projectId: ID(5),
    tasks: { total: 4, done: 1, cancelled: 1, open: 2, overdue: 1 },
    progressPercent: 33,
    sourceIdea: { id: ID(1), title: 'Boutique de wax en ligne' },
    ...overrides,
  };
}

export function task(overrides: Partial<Task> = {}): Task {
  return {
    id: ID(2),
    title: 'Appeler Moussa',
    description: null,
    status: 'TODO',
    priority: null,
    projectId: null,
    ideaId: null,
    parentTaskId: null,
    startsOn: null,
    dueDate: '2026-10-14',
    dueAt: null,
    completedAt: null,
    estimatedMinutes: null,
    actualMinutes: null,
    recurrence: null,
    recurrenceSeriesId: null,
    occurrenceDate: null,
    source: 'MANUAL',
    overdue: false,
    tagIds: [],
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function taskDetail(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return { ...task(), subtasks: [], dependsOn: [], blocks: [], ...overrides };
}

export function note(overrides: Partial<Note> = {}): Note {
  return {
    id: ID(3),
    title: 'Réunion client',
    content: '# Ordre du jour',
    contentFormat: 'MARKDOWN',
    kind: 'MEETING',
    source: 'MANUAL',
    pinnedAt: null,
    archivedAt: null,
    tagIds: [],
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    links: [],
    ...overrides,
  };
}

export function noteSummary(overrides: Partial<Note> = {}) {
  const { content, links: _links, ...rest } = note(overrides);
  return { ...rest, excerpt: content.slice(0, 280) };
}

export function tag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: ID(7),
    name: 'urgent',
    color: '#ff0000',
    usage: { ideas: 1, projects: 0, tasks: 2, notes: 0 },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** Listes vides par défaut pour les blocs annexes d'une fiche (notes liées, tâches, tags). */
export const emptyLists = [
  http.get('/api/v1/tags', () => HttpResponse.json({ data: [] })),
  http.get('/api/v1/notes', () => HttpResponse.json(page([]))),
  http.get('/api/v1/tasks', () => HttpResponse.json(page([]))),
  http.get('/api/v1/projects', () => HttpResponse.json(page([]))),
  http.get('/api/v1/ideas', () => HttpResponse.json(page([]))),
];
