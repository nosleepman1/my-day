import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps, JSX } from 'react';

import { cn } from '@/lib/cn';

import { OVERLAY_CLASS } from './dialog';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

const SIDES = {
  bottom:
    'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-(--radius-sheet) pb-[max(1rem,env(safe-area-inset-bottom))]',
  right: 'inset-y-0 right-0 h-full w-[min(24rem,100%)]',
} as const;

type SheetContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  side?: keyof typeof SIDES;
  closeLabel: string;
};

/** Feuille mobile (bas) ou panneau latéral (droite) : coins hauts arrondis, zone sûre respectée (§3.5). */
export function SheetContent({
  side = 'bottom',
  className,
  children,
  closeLabel,
  ...props
}: SheetContentProps): JSX.Element {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={OVERLAY_CLASS} />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col gap-4 overflow-y-auto bg-surface p-4 shadow-lg',
          SIDES[side],
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted"
        >
          <X aria-hidden="true" className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
