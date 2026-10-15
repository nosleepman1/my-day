import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, JSX } from 'react';

import { cn } from '@/lib/cn';

/** Un seul bouton primaire par écran (DESIGN_SYSTEM.md §1) ; zone tactile ≥ 44 px. */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-body-strong transition-colors duration-(--duration-fast) disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'border border-input-border bg-surface text-foreground hover:bg-surface-muted',
        ghost: 'text-foreground hover:bg-surface-muted',
        destructive: 'bg-danger text-danger-foreground hover:bg-danger/90',
        link: 'text-primary underline underline-offset-4',
      },
      size: {
        md: 'min-h-11 px-4',
        sm: 'min-h-9 px-3 text-small',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Rend l'enfant (lien du routeur…) avec le style du bouton. */
    asChild?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonProps): JSX.Element {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : (type ?? 'button')}
      {...props}
    />
  );
}
