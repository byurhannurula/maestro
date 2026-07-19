import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalize an unknown thrown value into a message string. */
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
