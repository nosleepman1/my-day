import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, JSX } from 'react';

import { cn } from '@/lib/cn';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-caption', {
  variants: {
    tone: {
      neutral: 'bg-surface-muted text-foreground',
      success: 'bg-success-surface text-success',
      warning: 'bg-warning-surface text-warning',
      danger: 'bg-danger-surface text-danger',
      info: 'bg-info-surface text-info',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

/** Pastille de statut : le texte porte le sens, la couleur n'est qu'un renfort (§3.2). */
export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>): JSX.Element {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** Squelette de chargement : forme du contenu attendu, sans texte (§6). */
export function Skeleton({ className, ...props }: ComponentProps<'div'>): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-surface-muted', className)}
      {...props}
    />
  );
}
