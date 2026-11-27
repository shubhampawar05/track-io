import { HttpError } from "../middleware/errorHandler";

/**
 * Typed readers for JSON request bodies. Rejecting non-string values stops objects such as
 * `{"$ne": null}` from reaching Mongo filters as query operators (NoSQL injection).
 */
export function bodyObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/** `undefined` when absent; the string when a string; 400 for any other type. */
export function optionalString(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  if (typeof v === "string") return v;
  throw new HttpError(400, `Invalid ${key}`);
}

/** Like optionalString but also allows an explicit `null` (used to clear a field). */
export function nullableString(body: Record<string, unknown>, key: string): string | null | undefined {
  if (body[key] === null) return null;
  return optionalString(body, key);
}
