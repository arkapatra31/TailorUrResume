import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function StepHeader({ icon: Icon, title, subtitle, id }: { icon: LucideIcon; title: string; subtitle: string; id: string }) {
  return (
    <div className="mb-8 flex items-start gap-4">
      <motion.div layoutId={`icon-${id}`} className="glass flex size-12 shrink-0 items-center justify-center rounded-2xl">
        <Icon className="size-6 text-accent" />
      </motion.div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl"><span className="text-gradient">{title}</span></h1>
        <p className="mt-1.5 max-w-2xl text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export function StepFooter({ children }: { children: ReactNode }) {
  return <div className="mt-8 flex flex-wrap items-center justify-between gap-3">{children}</div>;
}
