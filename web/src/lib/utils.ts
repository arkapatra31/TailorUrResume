import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const REPO = "https://github.com/arkapatra31/TailorUrResume";
/** Public asset URL that respects Vite's relative base (the site lives under /TailorUrResume/). */
export const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;
