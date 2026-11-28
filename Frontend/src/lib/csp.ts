/**
 * Content-Security-Policy for every HTML page (set per request by `src/proxy.ts`).
 *
 * - Scripts: only those carrying this request's nonce (Next.js and next-themes apply it), plus
 *   scripts they load ('strict-dynamic'). Blocks injected <script> and inline event handlers.
 * - Styles: 'unsafe-inline' is required because React `style={...}` attributes (dnd-kit,
 *   motion, Tiptap) cannot carry a nonce. Style injection is far less dangerous than scripts.
 * - Fonts: Google Fonts (Inter / JetBrains Mono, imported in globals.css): stylesheet from
 *   fonts.googleapis.com, font files from fonts.gstatic.com.
 * - Network/media/images: this origin plus the API origin (uploads are served by the API).
 *   Images also allow any https URL so images linked in issue descriptions still load.
 */
export function buildContentSecurityPolicy(opts: {
  nonce: string;
  apiOrigin: string;
  isDev: boolean;
}): string {
  const { nonce, apiOrigin, isDev } = opts;
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React needs eval in development only (debug stack reconstruction).
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "img-src": ["'self'", "blob:", "data:", "https:", apiOrigin],
    "media-src": ["'self'", "blob:", apiOrigin],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    // Dev: Next.js hot reload websocket.
    "connect-src": ["'self'", apiOrigin, ...(isDev ? ["ws:", "wss:"] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${[...new Set(v)].join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** Origin of NEXT_PUBLIC_API_BASE_URL (same default as `api-client.ts`). */
export function apiOriginFromEnv(raw: string | undefined): string {
  try {
    return new URL(raw?.trim() || "http://localhost:4000").origin;
  } catch {
    return "http://localhost:4000";
  }
}
