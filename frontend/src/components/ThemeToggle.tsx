import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { Tip } from "./ui/tooltip";
import { useStore } from "@/store";

export function ThemeToggle() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  return (
    <Tip label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
      <Button variant="glass" size="icon" aria-label="Toggle color theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </motion.span>
        </AnimatePresence>
      </Button>
    </Tip>
  );
}
