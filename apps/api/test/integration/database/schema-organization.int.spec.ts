import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

/** Comportement des objets manuels de la migration PHASE-04 (M03) : la base garantit ces invariants seule. */
describe('organization schema invariants (PHASE-04)', () => {
  let app: PrismaClient;
  let userId: string;
  let otherUserId: string;

  const insertUser = async (id: string) => {
    await app.$executeRaw`INSERT INTO users (id, email, password_hash, display_name) VALUES (${id}::uuid, ${`${id}@example.test`}, 'x', 'Org')`;
  };
  const insertTask = async (owner: string, id = randomUUID()) => {
    await app.$executeRaw`INSERT INTO tasks (id, user_id, title) VALUES (${id}::uuid, ${owner}::uuid, 'Tâche')`;
    return id;
  };
  const insertProject = async (owner: string, slug: string, id = randomUUID()) => {
    await app.$executeRaw`INSERT INTO projects (id, user_id, name, slug) VALUES (${id}::uuid, ${owner}::uuid, 'Projet', ${slug})`;
    return id;
  };
  const depend = (taskId: string, dependsOn: string) =>
    app.$executeRaw`INSERT INTO task_dependencies (user_id, task_id, depends_on_task_id) VALUES (${userId}::uuid, ${taskId}::uuid, ${dependsOn}::uuid)`;

  beforeAll(async () => {
    app = new PrismaClient({ datasourceUrl: inject('databaseUrl') });
    userId = randomUUID();
    otherUserId = randomUUID();
    await insertUser(userId);
    await insertUser(otherUserId);
  });

  afterAll(async () => {
    await app.$disconnect();
  });

  it('refuses a dependency cycle, direct or transitive', async () => {
    const [a, b, c] = [await insertTask(userId), await insertTask(userId), await insertTask(userId)];
    await depend(a, b);
    await depend(b, c);
    await expect(depend(c, a)).rejects.toThrow(/cycle/);
    await expect(depend(b, a)).rejects.toThrow(/cycle/);
    await expect(depend(a, a)).rejects.toThrow(/ck_task_dependencies__not_self|cycle/);
  });

  it('never links rows of two different users (composite foreign keys)', async () => {
    const mine = await insertTask(userId);
    const theirs = await insertTask(otherUserId);
    await expect(depend(mine, theirs)).rejects.toThrow(/foreign key|23503/i);
    const foreignProject = await insertProject(otherUserId, `foreign-${Date.now()}`);
    await expect(
      app.$executeRaw`INSERT INTO tasks (id, user_id, title, project_id) VALUES (${randomUUID()}::uuid, ${userId}::uuid, 'x', ${foreignProject}::uuid)`,
    ).rejects.toThrow(/foreign key|23503/i);
  });

  it('detaches tasks when their project is deleted, keeping user_id (SET NULL on one column)', async () => {
    const projectId = await insertProject(userId, `detach-${Date.now()}`);
    const taskId = randomUUID();
    await app.$executeRaw`INSERT INTO tasks (id, user_id, title, project_id) VALUES (${taskId}::uuid, ${userId}::uuid, 'x', ${projectId}::uuid)`;
    await app.$executeRaw`DELETE FROM projects WHERE id = ${projectId}::uuid`;
    const rows = await app.$queryRaw<{ user_id: string; project_id: string | null }[]>`
      SELECT user_id::text, project_id::text FROM tasks WHERE id = ${taskId}::uuid`;
    expect(rows).toEqual([{ user_id: userId, project_id: null }]);
  });

  it('purges the occurrences of a series together with its head (hard delete)', async () => {
    const head = randomUUID();
    await app.$executeRaw`INSERT INTO tasks (id, user_id, title, recurrence_rule, recurrence_anchor_on, recurrence_timezone)
      VALUES (${head}::uuid, ${userId}::uuid, 'Série', 'FREQ=DAILY', '2026-10-14', 'Africa/Dakar')`;
    await app.$executeRaw`INSERT INTO tasks (id, user_id, title, recurrence_series_id, occurrence_date, due_date)
      VALUES (${randomUUID()}::uuid, ${userId}::uuid, 'Série', ${head}::uuid, '2026-10-15', '2026-10-15')`;
    await app.$executeRaw`DELETE FROM tasks WHERE id = ${head}::uuid`;
    const left = await app.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*) AS n FROM tasks WHERE recurrence_series_id = ${head}::uuid`;
    expect(Number(left[0]?.n)).toBe(0);
  });

  it('keeps project slugs unique among live projects of the same user', async () => {
    const slug = `slug-${Date.now()}`;
    const first = await insertProject(userId, slug);
    await expect(insertProject(userId, slug)).rejects.toThrow(/23505/);
    await app.$executeRaw`UPDATE projects SET deleted_at = now() WHERE id = ${first}::uuid`;
    await expect(insertProject(userId, slug)).resolves.toBeTypeOf('string');
    await expect(insertProject(otherUserId, slug)).resolves.toBeTypeOf('string');
  });

  it('requires a note link to point at exactly one target', async () => {
    const noteId = randomUUID();
    await app.$executeRaw`INSERT INTO notes (id, user_id) VALUES (${noteId}::uuid, ${userId}::uuid)`;
    await expect(
      app.$executeRaw`INSERT INTO note_links (id, user_id, note_id) VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${noteId}::uuid)`,
    ).rejects.toThrow(/ck_note_links__one_target/);
  });

  it('ties task completion to completed_at and validates the recurrence rule', async () => {
    await expect(
      app.$executeRaw`INSERT INTO tasks (id, user_id, title, status) VALUES (${randomUUID()}::uuid, ${userId}::uuid, 'x', 'DONE')`,
    ).rejects.toThrow(/ck_tasks__done/);
    await expect(
      app.$executeRaw`INSERT INTO tasks (id, user_id, title, recurrence_rule, recurrence_anchor_on, recurrence_timezone)
        VALUES (${randomUUID()}::uuid, ${userId}::uuid, 'x', 'FREQ=HOURLY', '2026-10-14', 'Africa/Dakar')`,
    ).rejects.toThrow(/ck_tasks__recurrence_syntax/);
  });

  it('folds accents and case through f_unaccent for trigram search', async () => {
    const rows = await app.$queryRaw<
      { v: string }[]
    >`SELECT public.f_unaccent(lower('Énergie Créative')) AS v`;
    expect(rows[0]?.v).toBe('energie creative');
  });
});
