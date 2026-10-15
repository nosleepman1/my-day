import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import type { ComponentProps, JSX } from 'react';

import { cn } from '@/lib/cn';

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>): JSX.Element {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn('z-50 min-w-48 rounded-md bg-surface p-1 shadow-md', className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item>): JSX.Element {
  return (
    <MenuPrimitive.Item
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-body outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-muted [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Label>): JSX.Element {
  return (
    <MenuPrimitive.Label
      className={cn('px-3 py-2 text-caption text-muted-foreground', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>): JSX.Element {
  return <MenuPrimitive.Separator className={cn('my-1 h-px bg-border', className)} {...props} />;
}
