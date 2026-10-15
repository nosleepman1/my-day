import { CloudOff } from 'lucide-react';
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { captureQueue, onQueueChange, type PendingCapture } from '@/lib/offline/capture-queue';

function usePendingCaptures(ownerId: string): readonly PendingCapture[] {
  const [pending, setPending] = useState<readonly PendingCapture[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = (): void => {
      void captureQueue.pending(ownerId).then((items) => {
        if (active) setPending(items);
      });
    };
    refresh();
    const unsubscribe = onQueueChange(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [ownerId]);
  return pending;
}

function labelOf(capture: PendingCapture): string {
  const value = capture.body['title'] ?? capture.body['content'];
  return typeof value === 'string' ? value.slice(0, 80) : capture.id;
}

/**
 * Indicateur global de la file hors ligne (PHASE-04 §6) : nombre d'éléments en attente, et captures
 * refusées au rejeu, conservées avec leur erreur jusqu'à ce que l'utilisateur les abandonne.
 */
export function PendingCaptures({ ownerId }: Readonly<{ ownerId: string }>): JSX.Element | null {
  const { t } = useTranslation('capture');
  const pending = usePendingCaptures(ownerId);
  if (pending.length === 0) return null;
  const failed = pending.filter((capture) => capture.error !== null);
  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-2 rounded-md bg-warning-surface px-3 py-2 text-small text-warning"
    >
      <p className="flex items-center gap-2">
        <CloudOff aria-hidden="true" className="size-4" />
        {t('pending', { count: pending.length })}
      </p>
      {failed.map((capture) => (
        <div key={capture.id} className="flex items-center justify-between gap-2">
          <span>{t('failed', { title: labelOf(capture), code: capture.error ?? '' })}</span>
          <Button variant="ghost" size="sm" onClick={() => void captureQueue.discard(capture.id)}>
            {t('discard')}
          </Button>
        </div>
      ))}
    </div>
  );
}
