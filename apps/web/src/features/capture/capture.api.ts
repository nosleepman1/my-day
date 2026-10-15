import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';

import { ApiError, http } from '@/lib/http/client';
import { uuidv7 } from '@/lib/ids';
import {
  captureQueue,
  type CaptureKind,
  type PendingCapture,
  type SendOutcome,
} from '@/lib/offline/capture-queue';
import { organizationKeys } from '@/lib/query-keys';

const PATHS: Readonly<Record<CaptureKind, string>> = { idea: '/ideas', task: '/tasks', note: '/notes' };
const TITLE_MAX: Readonly<Record<'idea' | 'task', number>> = { idea: 200, task: 300 };

export type CaptureInput = Readonly<{ kind: CaptureKind; text: string; dueDate?: string }>;

/**
 * Corps de création d'une capture : la première ligne devient le titre (tronqué à la limite du
 * contrat), le reste la description ; une note garde tout son texte comme contenu.
 */
export function captureBody(input: CaptureInput, id: string): Record<string, unknown> {
  const text = input.text.trim();
  if (input.kind === 'note') return { id, content: text, source: 'QUICK_CAPTURE' };
  const [first = '', ...rest] = text.split('\n');
  const max = TITLE_MAX[input.kind];
  const title = first.trim().slice(0, max);
  const overflow = [first.trim().slice(max), ...rest].join('\n').trim();
  return {
    id,
    title,
    source: 'QUICK_CAPTURE',
    ...(overflow === '' ? {} : { description: overflow }),
    ...(input.kind === 'task' && input.dueDate !== undefined && input.dueDate !== ''
      ? { dueDate: input.dueDate }
      : {}),
  };
}

/** 4xx métier : erreur définitive gardée pour correction ; réseau, 401, 429 et 5xx : nouvel essai plus tard. */
function outcomeOf(error: unknown): SendOutcome {
  if (!(error instanceof ApiError)) return { status: 'retry' };
  if (error.status >= 500 || error.status === 401 || error.status === 429) return { status: 'retry' };
  return { status: 'failed', error: error.code };
}

export async function sendCapture(capture: PendingCapture): Promise<SendOutcome> {
  try {
    await http(PATHS[capture.kind], z.unknown(), { method: 'POST', body: capture.body });
    return { status: 'sent' };
  } catch (error) {
    return outcomeOf(error);
  }
}

export type CaptureResult = 'sent' | 'queued';

/**
 * Capture en ligne, ou mise en file hors ligne si le réseau manque (ADR-016). Une erreur métier (4xx)
 * est relancée pour être affichée dans la feuille de capture.
 */
export async function submitCapture(
  input: CaptureInput,
  ownerId: string,
  now: Date = new Date(),
): Promise<CaptureResult> {
  const id = uuidv7(now.getTime());
  const capture = {
    id,
    ownerId,
    kind: input.kind,
    body: captureBody(input, id),
    createdAt: now.toISOString(),
  };
  if (navigator.onLine) {
    try {
      await http(PATHS[input.kind], z.unknown(), { method: 'POST', body: capture.body });
      return 'sent';
    } catch (error) {
      if (outcomeOf(error).status === 'failed') throw error;
    }
  }
  await captureQueue.enqueue(capture);
  return 'queued';
}

/** Rejoue les captures du compte connecté au démarrage et au retour du réseau, puis rafraîchit les listes. */
export function useCaptureSync(ownerId: string): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const replay = (): void => {
      void captureQueue.replay(sendCapture, ownerId).then((sent) => {
        if (sent > 0) void queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      });
    };
    replay();
    window.addEventListener('online', replay);
    return () => {
      window.removeEventListener('online', replay);
    };
  }, [queryClient, ownerId]);
}
