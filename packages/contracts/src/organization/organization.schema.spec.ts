import { describe, expect, it } from 'vitest';

import { IdeaListQuerySchema, CreateIdeaRequestSchema, UpdateIdeaRequestSchema } from './ideas.schema';
import { CreateNoteLinkRequestSchema, CreateNoteRequestSchema, NOTE_CONTENT_MAX } from './notes.schema';
import { CreateProjectRequestSchema, ProjectSlugSchema } from './projects.schema';
import { CreateTagRequestSchema } from './tags.schema';
import { CreateTaskRequestSchema, TaskListQuerySchema, UpdateTaskRequestSchema } from './tasks.schema';

const V7 = '0192f1c3-7a2b-7c1e-9d0f-3b4c5d6e7f81';
const V4 = '9b2d7c1e-4f3a-4b5c-8d6e-7f8091a2b3c4';

describe('organization request schemas', () => {
  it('trims and normalizes an idea title and rejects a blank one', () => {
    expect(CreateIdeaRequestSchema.parse({ title: '  Café solidaire  ' }).title).toBe('Café solidaire');
    expect(CreateIdeaRequestSchema.safeParse({ title: '   ' }).success).toBe(false);
  });

  it('accepts only a client UUIDv7 as idea id', () => {
    expect(CreateIdeaRequestSchema.safeParse({ id: V7, title: 'x' }).success).toBe(true);
    expect(CreateIdeaRequestSchema.safeParse({ id: V4, title: 'x' }).success).toBe(false);
  });

  it('refuses unknown keys and server-only sources', () => {
    expect(CreateIdeaRequestSchema.safeParse({ title: 'x', userId: V7 }).success).toBe(false);
    expect(CreateIdeaRequestSchema.safeParse({ title: 'x', source: 'AI' }).success).toBe(false);
  });

  it('clears an optional text with an empty string', () => {
    expect(UpdateIdeaRequestSchema.parse({ description: '  ' }).description).toBeNull();
  });

  it('bounds the potential score', () => {
    expect(UpdateIdeaRequestSchema.safeParse({ potentialScore: 11 }).success).toBe(false);
    expect(UpdateIdeaRequestSchema.safeParse({ potentialScore: 7 }).success).toBe(true);
  });

  it('parses comma-separated status filters and rejects unknown values', () => {
    expect(IdeaListQuerySchema.parse({ status: 'INBOX,SELECTED' }).status).toEqual(['INBOX', 'SELECTED']);
    expect(IdeaListQuerySchema.safeParse({ status: 'INBOX,DROP TABLE' }).success).toBe(false);
    expect(IdeaListQuerySchema.parse({}).archived).toBe('false');
  });

  it('validates project slugs and date order', () => {
    expect(ProjectSlugSchema.safeParse('orbit-v2').success).toBe(true);
    expect(ProjectSlugSchema.safeParse('Orbit V2').success).toBe(false);
    expect(
      CreateProjectRequestSchema.safeParse({ name: 'x', startsOn: '2026-10-14', targetOn: '2026-10-01' })
        .success,
    ).toBe(false);
  });

  it('normalizes a recurrence rule and refuses unsupported ones', () => {
    const parsed = CreateTaskRequestSchema.parse({
      title: 'x',
      recurrence: { rule: 'freq=weekly;byday=mo' },
    });
    expect(parsed.recurrence?.rule).toBe('FREQ=WEEKLY;BYDAY=MO');
    expect(
      CreateTaskRequestSchema.safeParse({ title: 'x', recurrence: { rule: 'FREQ=SECONDLY' } }).success,
    ).toBe(false);
  });

  it('requires a due date with a due time and forbids DONE through PATCH', () => {
    expect(CreateTaskRequestSchema.safeParse({ title: 'x', dueAt: '2026-10-14T09:00:00Z' }).success).toBe(
      false,
    );
    expect(UpdateTaskRequestSchema.safeParse({ status: 'DONE' }).success).toBe(false);
  });

  it('accepts `none` or a UUID as task parent filter', () => {
    expect(TaskListQuerySchema.parse({ parentTaskId: 'none' }).parentTaskId).toBe('none');
    expect(TaskListQuerySchema.safeParse({ parentTaskId: 'root' }).success).toBe(false);
  });

  it('caps note content and requires exactly one link target', () => {
    expect(CreateNoteRequestSchema.safeParse({ content: 'a'.repeat(NOTE_CONTENT_MAX + 1) }).success).toBe(
      false,
    );
    expect(CreateNoteLinkRequestSchema.safeParse({}).success).toBe(false);
    expect(CreateNoteLinkRequestSchema.safeParse({ ideaId: V7, taskId: V7 }).success).toBe(false);
    expect(CreateNoteLinkRequestSchema.safeParse({ taskId: V7 }).success).toBe(true);
  });

  it('validates tag names and colors', () => {
    expect(CreateTagRequestSchema.safeParse({ name: 'x'.repeat(41) }).success).toBe(false);
    expect(CreateTagRequestSchema.safeParse({ name: 'urgent', color: 'red' }).success).toBe(false);
    expect(CreateTagRequestSchema.safeParse({ name: 'urgent', color: '#FF0000' }).success).toBe(true);
  });
});
