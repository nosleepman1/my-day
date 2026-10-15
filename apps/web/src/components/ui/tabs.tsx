import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentProps, JSX } from 'react';

import { cn } from '@/lib/cn';

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>): JSX.Element {
  return (
    <TabsPrimitive.List
      className={cn('inline-flex gap-1 overflow-x-auto rounded-md bg-surface-muted p-1', className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>): JSX.Element {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex min-h-9 items-center rounded-sm px-3 text-small whitespace-nowrap text-muted-foreground data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        className,
      )}
      {...props}
    />
  );
}
