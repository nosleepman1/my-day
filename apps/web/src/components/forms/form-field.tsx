import { useId, type JSX, type ReactElement } from 'react';
import { cloneElement } from 'react';

import { Label } from '@/components/ui/label';

type ControlProps = Readonly<{
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}>;

type FormFieldProps = Readonly<{
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactElement<ControlProps>;
}>;

/**
 * Relie libellé, aide et erreur à son contrôle (`id`, `aria-invalid`, `aria-describedby`) :
 * seul point d'entrée des champs de formulaire (FRONTEND.md §6).
 */
export function FormField({ label, error, hint, children }: FormFieldProps): JSX.Element {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint === undefined ? null : hintId, error === undefined ? null : errorId]
    .filter((value) => value !== null)
    .join(' ');
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, {
        id,
        'aria-invalid': error !== undefined,
        ...(describedBy === '' ? {} : { 'aria-describedby': describedBy }),
      })}
      {hint !== undefined && (
        <p id={hintId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
