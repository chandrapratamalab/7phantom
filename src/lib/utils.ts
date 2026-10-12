import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names with conditional support.
 *
 * `twMerge` resolves conflicting utilities so a caller can always override a
 * component's default classes: `cn("p-4", "p-6")` -> `"p-6"`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
