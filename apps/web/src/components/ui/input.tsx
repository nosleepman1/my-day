import type { ComponentProps, JSX } from 'react';

import { cn } from '@/lib/cn';

/** Bordure de champ à 3:1 minimum (`--input-border`, §3.1) ; `aria-invalid` passe la bordure en danger. */
const FIELD =
  'w-full rounded-md border border-input-border bg-surface px-3 text-body text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger';

export function Input({ className, ...props }: ComponentProps<'input'>): JSX.Element {
  return <input className={cn(FIELD, 'min-h-11', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>): JSX.Element {
  return <textarea className={cn(FIELD, 'min-h-24 py-2', className)} {...props} />;
}
