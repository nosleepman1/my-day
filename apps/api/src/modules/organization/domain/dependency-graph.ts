/** « `taskId` dépend de `dependsOnTaskId` » (table `task_dependencies`). */
export type DependencyEdge = Readonly<{ taskId: string; dependsOnTaskId: string }>;

/**
 * Vrai si ajouter « `taskId` dépend de `dependsOnTaskId` » fermerait un cycle, c'est-à-dire si
 * `dependsOnTaskId` dépend déjà, directement ou non, de `taskId` (ou s'il s'agit de la même tâche).
 * Contrôle applicatif pour un message clair ; le déclencheur `trg_task_dependencies__no_cycle` reste la garantie.
 */
export function wouldCreateCycle(
  edges: readonly DependencyEdge[],
  taskId: string,
  dependsOnTaskId: string,
): boolean {
  if (taskId === dependsOnTaskId) return true;
  const successors = new Map<string, string[]>();
  for (const edge of edges) {
    successors.set(edge.taskId, [...(successors.get(edge.taskId) ?? []), edge.dependsOnTaskId]);
  }
  const pending = [dependsOnTaskId];
  const visited = new Set<string>();
  for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
    if (current === taskId) return true;
    if (!visited.has(current)) {
      visited.add(current);
      pending.push(...(successors.get(current) ?? []));
    }
  }
  return false;
}
