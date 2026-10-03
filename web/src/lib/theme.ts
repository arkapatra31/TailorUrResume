import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
const root = document.documentElement;
const listeners = new Set<() => void>();

// The theme lives on <html data-theme>, set before first paint from the OS preference. Not persisted.
const get = (): Theme => (root.dataset.theme === "light" ? "light" : "dark");

export function setTheme(t: Theme) {
  root.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "light" ? "#f8fafc" : "#020617");
  listeners.forEach((l) => l());
}

export const useTheme = () =>
  useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), get, get);
