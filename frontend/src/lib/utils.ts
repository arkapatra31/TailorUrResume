import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const uid = () => Math.random().toString(36).slice(2, 10);
export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function hostOf(url: string): string {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname; } catch { return ""; }
}
