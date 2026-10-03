import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, ...p }, ref) => (
    <TabsPrimitive.List ref={ref} className={cn("glass inline-flex items-center gap-1 rounded-xl p-1", className)} {...p} />
  ),
);
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...p }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all",
        "hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md",
        className,
      )}
      {...p}
    />
  ),
);
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = TabsPrimitive.Content;
