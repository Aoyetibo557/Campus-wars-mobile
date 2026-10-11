import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class lists and resolve Tailwind conflicts
 * (tailwind-merge@2 — the major that targets Tailwind v3; v3.x targets TW v4).
 * Custom token classes like `text-text` / `bg-surface-raised` are treated as
 * color utilities, so later conflicting colors win.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
