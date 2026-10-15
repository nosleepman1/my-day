import * as LabelPrimitive from '@radix-ui/react-label';
import type { ComponentProps, JSX } from 'react';

import { cn } from '@/lib/cn';

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>): JSX.Element {
  return (
    <LabelPrimitive.Root className={cn('text-small font-medium text-foreground', className)} {...props} />
  );
}
