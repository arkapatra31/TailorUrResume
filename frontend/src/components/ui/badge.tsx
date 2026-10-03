import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "bg-muted/70 text-foreground",
      success: "bg-success/15 text-success border-success/40",
      warn: "bg-warn/15 text-warn border-warn/40",
      danger: "bg-danger/15 text-danger border-danger/40",
      primary: "bg-primary/20 text-foreground border-primary/50",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...p} />;
}
