import * as SwitchPrimitive from '@radix-ui/react-switch';
import type { ComponentProps, JSX } from 'react';

import { cn } from '@/lib/cn';

/** Interrupteur : piste de 44 × 26 px, état lisible sans la couleur (position du curseur). */
export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>): JSX.Element {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'inline-flex h-[26px] w-11 shrink-0 cursor-pointer items-center rounded-full border border-input-border bg-surface-muted p-0.5 transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 rounded-full bg-surface shadow-sm transition-transform duration-(--duration-fast) data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}
