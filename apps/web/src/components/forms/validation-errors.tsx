import { AlertCircle } from 'lucide-react';
import type { JSX } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { displayCodeOf, fieldIssuesOf, retryAfterOf } from '@/lib/http/api-error-message';
import { useErrorText } from '@/lib/i18n/use-error-text';

/**
 * Reporte les erreurs d'un `VALIDATION_FAILED` sur les champs connus du formulaire (FRONTEND.md §3.4) ;
 * renvoie `true` si au moins un champ a reçu une erreur. Le premier champ en erreur reçoit le focus.
 */
export function applyApiFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  const known = fieldIssuesOf(error).filter((issue) => fields.includes(issue.path.join('.') as Path<T>));
  known.forEach((issue, index) => {
    setError(
      issue.path.join('.') as Path<T>,
      { type: 'server', message: issue.message },
      { shouldFocus: index === 0 },
    );
  });
  return known.length > 0;
}

type FormErrorProps = Readonly<{ error: unknown }>;

/** Erreur générale d'un formulaire (hors champ) : message i18n du code, jamais celui de l'API. */
export function FormError({ error }: FormErrorProps): JSX.Element | null {
  const errorText = useErrorText();
  if (error === null || error === undefined) return null;
  const code = displayCodeOf(error);
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md bg-danger-surface px-3 py-2 text-small text-danger"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>{errorText(code, retryAfterOf(error) ?? 60)}</p>
    </div>
  );
}

type ValidationSummaryProps = Readonly<{ messages: readonly string[] }>;

/** Résumé en haut du formulaire à partir de 3 erreurs (DESIGN_SYSTEM.md §6). */
export function ValidationSummary({ messages }: ValidationSummaryProps): JSX.Element | null {
  const { t } = useTranslation();
  if (messages.length < 3) return null;
  return (
    <div role="alert" className="rounded-md bg-danger-surface px-3 py-2 text-small text-danger">
      <p>{t('states.formErrors')}</p>
      <ul className="mt-1 list-disc pl-5">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
