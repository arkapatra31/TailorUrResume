import { AnimatePresence, motion } from "framer-motion";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { GithubIcon } from "@/components/ui";
import { setTheme, useTheme } from "@/lib/theme";
import { asset, cn, REPO } from "@/lib/utils";

const LINKS = [
  ["Tour", "tour"], ["Skill bridge", "bridge"], ["Truth guard", "truth"], ["Privacy", "privacy"], ["Get started", "start"], ["FAQ", "faq"],
] as const;

function useScrollSpy(ids: readonly string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
    }, { rootMargin: "-45% 0px -50% 0px" });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [ids]);
  return active;
}

export function Nav() {
  const theme = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const active = useScrollSpy(LINKS.map(([, id]) => id));

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("keydown", esc); };
  }, []);

  return (
    <header className={cn("sticky top-0 z-40 border-b border-transparent transition-colors duration-300",
      (scrolled || open) && "border-border bg-background/75 backdrop-blur-xl")}>
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2.5 text-[1.05rem] font-bold tracking-tight" aria-label="TailorUrResume home">
          <img src={asset("favicon.svg")} alt="" width={28} height={28} className="rounded-lg" />
          <span>TailorUr<span className="text-primary">Resume</span></span>
        </a>
        <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
          {LINKS.map(([label, id]) => (
            <a key={id} href={`#${id}`} className={cn("relative rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              active === id && "text-foreground")}>
              {active === id && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-lg bg-[hsl(var(--glass-strong))]" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="glass grid size-10 place-items-center rounded-xl transition hover:bg-[hsl(var(--glass-strong))]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>
                {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
              </motion.span>
            </AnimatePresence>
          </button>
          <a href={REPO} target="_blank" rel="noopener" className="glass hidden items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition hover:bg-[hsl(var(--glass-strong))] sm:inline-flex">
            <GithubIcon className="size-4" /> GitHub
          </a>
          <button type="button" className="glass grid size-10 place-items-center rounded-xl lg:hidden" aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>
            {open ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav id="mobile-nav" aria-label="Sections" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t lg:hidden">
            <div className="wrap grid gap-1 py-3">
              {LINKS.map(([label, id]) => (
                <a key={id} href={`#${id}`} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-[hsl(var(--glass-strong))] hover:text-foreground">{label}</a>
              ))}
              <a href={REPO} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:hidden">
                <GithubIcon className="size-4" /> GitHub
              </a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
