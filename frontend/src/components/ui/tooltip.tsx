import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type * as React from "react";

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tip({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="glass glass-strong z-50 max-w-xs rounded-lg px-3 py-1.5 text-xs text-foreground"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
