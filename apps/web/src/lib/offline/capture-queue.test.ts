import { describe, expect, it } from 'vitest';

import { uuidv7 } from '../ids';

import {
  createCaptureQueue,
  createMemoryStore,
  type PendingCapture,
  type SendOutcome,
} from './capture-queue';

const OWNER = 'user-a';

const capture = (title: string, createdAt: string, ownerId = OWNER) => ({
  id: uuidv7(Date.parse(createdAt)),
  ownerId,
  kind: 'idea' as const,
  body: { title },
  createdAt,
});

const sent = (): Promise<SendOutcome> => Promise.resolve({ status: 'sent' });

describe('offline capture queue (ADR-016)', () => {
  it('replays captures in order and removes the sent ones', async () => {
    const queue = createCaptureQueue(createMemoryStore());
    await queue.enqueue(capture('deux', '2026-10-14T10:00:01.000Z'));
    await queue.enqueue(capture('un', '2026-10-14T10:00:00.000Z'));
    const titles: string[] = [];
    const count = await queue.replay((item) => {
      titles.push(String(item.body['title']));
      return sent();
    }, OWNER);
    expect(count).toBe(2);
    expect(titles).toEqual(['un', 'deux']);
    expect(await queue.pending()).toEqual([]);
  });

  it('never replays nor lists the captures of another account', async () => {
    const queue = createCaptureQueue(createMemoryStore());
    await queue.enqueue(capture('à moi', '2026-10-14T10:00:00.000Z'));
    await queue.enqueue(capture('à B', '2026-10-14T10:00:01.000Z', 'user-b'));
    const titles: string[] = [];
    await queue.replay((item) => {
      titles.push(String(item.body['title']));
      return sent();
    }, OWNER);
    expect(titles).toEqual(['à moi']);
    expect((await queue.pending(OWNER)).length).toBe(0);
    expect((await queue.pending('user-b')).map((item) => item.body['title'])).toEqual(['à B']);
    await queue.clear();
    expect(await queue.pending()).toEqual([]);
  });

  it('stops at the first retryable failure and keeps the rest', async () => {
    const queue = createCaptureQueue(createMemoryStore());
    await queue.enqueue(capture('un', '2026-10-14T10:00:00.000Z'));
    await queue.enqueue(capture('deux', '2026-10-14T10:00:01.000Z'));
    const outcomes: SendOutcome[] = [{ status: 'retry' }];
    await queue.replay(() => Promise.resolve(outcomes.shift() ?? { status: 'sent' }), OWNER);
    expect(await queue.pending()).toHaveLength(2);
  });

  it('keeps a definitive failure with its error and continues', async () => {
    const queue = createCaptureQueue(createMemoryStore());
    await queue.enqueue(capture('invalide', '2026-10-14T10:00:00.000Z'));
    await queue.enqueue(capture('valide', '2026-10-14T10:00:01.000Z'));
    await queue.replay(
      (item: PendingCapture) =>
        Promise.resolve(
          item.body['title'] === 'invalide'
            ? { status: 'failed', error: 'VALIDATION_FAILED' }
            : { status: 'sent' },
        ),
      OWNER,
    );
    const left = await queue.pending();
    expect(left.map((item) => [item.body['title'], item.error])).toEqual([['invalide', 'VALIDATION_FAILED']]);
  });

  it('runs a single replay at a time', async () => {
    const queue = createCaptureQueue(createMemoryStore());
    await queue.enqueue(capture('un', '2026-10-14T10:00:00.000Z'));
    let calls = 0;
    const send = async (): Promise<SendOutcome> => {
      calls += 1;
      await Promise.resolve();
      return { status: 'sent' };
    };
    await Promise.all([queue.replay(send, OWNER), queue.replay(send, OWNER)]);
    expect(calls).toBe(1);
  });

  it('generates sortable UUIDv7 identifiers', () => {
    const first = uuidv7(Date.parse('2026-10-14T10:00:00.000Z'));
    const second = uuidv7(Date.parse('2026-10-14T10:00:00.001Z'));
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first < second).toBe(true);
  });
});
