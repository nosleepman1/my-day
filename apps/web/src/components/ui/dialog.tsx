import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps, JSX } from 'react';

import { cn } from '@/lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const OVERLAY_CLASS =
  'fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out';

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  /** Libellé accessible du bouton de fermeture (texte traduit fourni par l'appelant). */
  closeLabel: string;
};

/** Dialogue centré (DESIGN_SYSTEM.md §5.1) ; focus piégé et Échap gérés par Radix. */
export function DialogContent({
  className,
  children,
  closeLabel,
  ...props
}: DialogContentProps): JSX.Element {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={OVERLAY_CLASS} />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg bg-surface p-6 shadow-lg',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted"
        >
          <X aria-hidden="true" className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>): JSX.Element {
  return <div className={cn('flex flex-col gap-1 pr-10', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>): JSX.Element {
  return (
    <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>): JSX.Element {
  return <DialogPrimitive.Title className={cn('text-h2', className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>): JSX.Element {
  return (
    <DialogPrimitive.Description className={cn('text-small text-muted-foreground', className)} {...props} />
  );
}
