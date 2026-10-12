import { setTimeout as sleepFor } from 'node:timers/promises';

export type DurationTools = Readonly<{
  now: () => number;
  sleep: (milliseconds: number) => Promise<unknown>;
}>;

const DEFAULT_TOOLS: DurationTools = { now: () => performance.now(), sleep: sleepFor };

/**
 * Exécute `task` et ne rend la main qu'après `minimumMs`, en succès comme en échec. Les routes à réponse
 * uniforme (inscription, renvoi de vérification) ne révèlent ainsi pas, par leur durée, si un compte existe
 * (SECURITY.md §3.8).
 */
export async function enforceMinimumDuration<T>(
  task: () => Promise<T>,
  minimumMs: number,
  tools: DurationTools = DEFAULT_TOOLS,
): Promise<T> {
  const started = tools.now();
  try {
    return await task();
  } finally {
    const remaining = minimumMs - (tools.now() - started);
    if (remaining > 0) await tools.sleep(remaining);
  }
}
