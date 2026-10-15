import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ComponentProps, JSX } from 'react';

import { cn } from '@/lib/cn';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

/** Infobulle d'appoint uniquement : aucune fonction n'est accessible seulement au survol (§1). */
export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>): JSX.Element {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn('z-50 rounded-sm bg-foreground px-2 py-1 text-caption text-background', className)}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
