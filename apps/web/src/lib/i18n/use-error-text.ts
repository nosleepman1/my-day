import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { DisplayErrorCode } from '@/lib/http/api-error-message';

/** Texte `errors.<CODE>` d'une erreur (FRONTEND.md §3.5) ; `seconds` alimente `RATE_LIMITED`. */
export function useErrorText(): (code: DisplayErrorCode, seconds?: number) => string {
  const { t } = useTranslation('errors');
  return useCallback((code, seconds = 0) => t(code, { seconds }), [t]);
}
