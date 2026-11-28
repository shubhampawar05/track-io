import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Decode a dynamic route segment once. Next 16 hands `params` / `useParams()` values over
 * still percent-encoded; a malformed sequence (e.g. a lone `%`) falls back to the raw value
 * instead of throwing `URIError`.
 */
export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
