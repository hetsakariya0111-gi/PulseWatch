import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins conditional class names and resolves conflicting Tailwind utilities
 * (later wins), e.g. cn("p-2", "p-4") -> "p-4".
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
