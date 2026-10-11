import { createBrowserRouter } from 'react-router';

import { SystemStatusPage } from '@/features/system';

/** Routeur de données (FRONTEND.md §9). Les routes publiques et applicatives arrivent en PHASE-01 et PHASE-02. */
export function createAppRouter(): ReturnType<typeof createBrowserRouter> {
  return createBrowserRouter([{ path: '/', element: <SystemStatusPage /> }]);
}
