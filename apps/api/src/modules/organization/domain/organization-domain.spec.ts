import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { IDEA_STATUSES } from '@orbit/contracts';

import { DomainError } from '../../../platform/errors/domain-error';

import { type DependencyEdge, wouldCreateCycle } from './dependency-graph';
import { assertIdeaTransition, canTransitionIdea } from './idea-status';
import { firstFreeSlug, slugify } from './slug';
import { assertPatchableStatus, assertReopenable, progressPercent } from './task-rules';

/** Vrai si le graphe est acyclique (tri topologique de Kahn). */
function isAcyclic(nodes: readonly string[], edges: readonly DependencyEdge[]): boolean {
  const indegree = new Map(nodes.map((node) => [node, 0]));
  for (const edge of edges) indegree.set(edge.dependsOnTaskId, (indegree.get(edge.dependsOnTaskId) ?? 0) + 1);
  const ready = nodes.filter((node) => indegree.get(node) === 0);
  let removed = 0;
  for (let node = ready.pop(); node !== undefined; node = ready.pop()) {
    removed += 1;
    for (const edge of edges.filter((candidate) => candidate.taskId === node)) {
      const remaining = (indegree.get(edge.dependsOnTaskId) ?? 0) - 1;
      indegree.set(edge.dependsOnTaskId, remaining);
      if (remaining === 0) ready.push(edge.dependsOnTaskId);
    }
  }
  return removed === nodes.length;
}

describe('dependency graph', () => {
  const edge = (taskId: string, dependsOnTaskId: string): DependencyEdge => ({ taskId, dependsOnTaskId });

  it('detects self, direct and transitive cycles', () => {
    const edges = [edge('a', 'b'), edge('b', 'c')];
    expect(wouldCreateCycle(edges, 'a', 'a')).toBe(true);
    expect(wouldCreateCycle(edges, 'b', 'a')).toBe(true);
    expect(wouldCreateCycle(edges, 'c', 'a')).toBe(true);
    expect(wouldCreateCycle(edges, 'a', 'c')).toBe(false);
    expect(wouldCreateCycle(edges, 'd', 'a')).toBe(false);
  });

  it('never yields a cycle after any sequence of accepted additions (property)', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const node = fc.constantFrom(...nodes);
    fc.assert(
      fc.property(fc.array(fc.tuple(node, node), { maxLength: 60 }), (attempts) => {
        const accepted: DependencyEdge[] = [];
        for (const [from, to] of attempts) {
          if (!wouldCreateCycle(accepted, from, to)) accepted.push(edge(from, to));
        }
        return isAcyclic(nodes, accepted);
      }),
    );
  });

  it('refuses exactly the additions that would close a cycle (property)', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e'];
    const node = fc.constantFrom(...nodes);
    fc.assert(
      fc.property(fc.array(fc.tuple(node, node), { maxLength: 30 }), node, node, (attempts, from, to) => {
        const accepted: DependencyEdge[] = [];
        for (const [a, b] of attempts) if (!wouldCreateCycle(accepted, a, b)) accepted.push(edge(a, b));
        const refused = wouldCreateCycle(accepted, from, to);
        return refused === !isAcyclic(nodes, [...accepted, edge(from, to)]);
      }),
    );
  });
});

describe('idea state machine', () => {
  it('allows staying in place and documented moves only', () => {
    for (const status of IDEA_STATUSES) expect(canTransitionIdea(status, status)).toBe(true);
    expect(canTransitionIdea('INBOX', 'SELECTED')).toBe(true);
    expect(canTransitionIdea('INBOX', 'REALIZED')).toBe(false);
    expect(canTransitionIdea('ABANDONED', 'INBOX')).toBe(true);
    expect(() => {
      assertIdeaTransition('REALIZED', 'INBOX');
    }).toThrow(DomainError);
  });
});

describe('task rules', () => {
  it('requires reopen to leave a terminal status', () => {
    expect(() => {
      assertPatchableStatus('DONE', 'TODO');
    }).toThrow(DomainError);
    expect(() => {
      assertPatchableStatus('TODO', 'CANCELLED');
    }).not.toThrow();
    expect(() => {
      assertReopenable('TODO');
    }).toThrow(DomainError);
    expect(() => {
      assertReopenable('CANCELLED');
    }).not.toThrow();
  });

  it('computes project progress over non-cancelled tasks', () => {
    expect(progressPercent({ total: 0, done: 0, cancelled: 0 })).toBeNull();
    expect(progressPercent({ total: 2, done: 0, cancelled: 2 })).toBeNull();
    expect(progressPercent({ total: 4, done: 1, cancelled: 1 })).toBe(33);
    expect(progressPercent({ total: 3, done: 3, cancelled: 0 })).toBe(100);
  });
});

describe('project slugs', () => {
  it('strips accents and punctuation', () => {
    expect(slugify('  Café — Boutique Dakar !')).toBe('cafe-boutique-dakar');
    expect(slugify('!!!')).toBe('projet');
    expect(slugify('x'.repeat(100))).toHaveLength(80);
  });

  it('picks the first free suffix', () => {
    expect(firstFreeSlug('orbit', new Set())).toBe('orbit');
    expect(firstFreeSlug('orbit', new Set(['orbit', 'orbit-2']))).toBe('orbit-3');
    const long = 'a'.repeat(80);
    expect(firstFreeSlug(long, new Set([long]))).toHaveLength(80);
  });
});
