import type { JSX } from 'react';

import { useLiveness } from '../api/health.api';

// Textes provisoires : l'i18n (i18next, fr) est mise en place en PHASE-02.
const MESSAGES = {
  checking: "Vérification de l'API…",
  ok: 'API OK',
  unreachable: 'API injoignable',
} as const;

/** Page technique de PHASE-00 : vérifie la chaîne front → proxy /api → API. */
export function SystemStatusPage(): JSX.Element {
  const liveness = useLiveness();
  const message = liveness.isPending
    ? MESSAGES.checking
    : liveness.isError
      ? MESSAGES.unreachable
      : MESSAGES.ok;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">ORBIT</h1>
      <p role="status" aria-live="polite" className="text-base">
        {message}
      </p>
    </main>
  );
}
