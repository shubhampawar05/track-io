const PROBE_ORIGIN = "http://x.invalid";

/** Backslashes (browsers treat `\` like `/`), ASCII control chars, and any whitespace. */
function hasUnsafeChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f || c === 0x5c) return true;
  }
  return /\s/.test(s);
}

/** Prevents open redirects: only same-origin relative paths. */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  if (hasUnsafeChars(t)) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(t);
  } catch {
    return null;
  }
  if (decoded.startsWith("//") || hasUnsafeChars(decoded)) return null;

  let url: URL;
  try {
    url = new URL(t, PROBE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PROBE_ORIGIN) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
