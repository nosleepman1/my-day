import type { ComponentProps, JSX } from 'react';

import { cn } from '@/lib/cn';

export function Card({ className, ...props }: ComponentProps<'section'>): JSX.Element {
  return <section className={cn('rounded-lg bg-surface p-4 shadow-sm', className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<'header'>): JSX.Element {
  return <header className={cn('mb-3 flex flex-col gap-1', className)} {...props} />;
}

export function CardTitle({ className, children, ...props }: ComponentProps<'h2'>): JSX.Element {
  return (
    <h2 className={cn('text-h3', className)} {...props}>
      {children}
    </h2>
  );
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>): JSX.Element {
  return <p className={cn('text-small text-muted-foreground', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'footer'>): JSX.Element {
  return <footer className={cn('mt-4 flex items-center justify-end gap-2', className)} {...props} />;
}
