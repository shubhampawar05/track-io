import { HttpError } from "../middleware/errorHandler";

/** Upper bounds for free-text fields (security spec §6: bound every user-supplied string). */
export const LIMITS = {
  issueTitle: 500,
  /** Rich-text HTML from the editor. */
  issueDescription: 100_000,
  comment: 10_000,
  /** Person, project and workspace names. */
  name: 100,
  email: 254,
} as const;

export function assertMaxLength(value: string, max: number, label: string): void {
  if (value.length > max) throw new HttpError(400, `${label} is too long (max ${max} characters)`);
}

/**
 * Pragmatic address check: one "@", no whitespace, no characters that change meaning in mail
 * headers or display-name syntax (`<>()[],;:"\`), and a dotted domain.
 */
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:".]{2,}$/;

export function isValidEmail(email: string): boolean {
  return email.length <= LIMITS.email && EMAIL_PATTERN.test(email);
}
