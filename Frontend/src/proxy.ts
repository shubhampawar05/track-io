import { NextResponse, type NextRequest } from "next/server";
import { apiOriginFromEnv, buildContentSecurityPolicy } from "@/lib/csp";

/** Sets a per-request nonce-based Content-Security-Policy (see `lib/csp.ts`). */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy({
    nonce,
    apiOrigin: apiOriginFromEnv(process.env.NEXT_PUBLIC_API_BASE_URL),
    isDev: process.env.NODE_ENV === "development",
  });

  // Next.js reads the nonce from the request's CSP header and applies it to its own scripts;
  // the root layout reads x-nonce for next-themes' inline script.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: static files and image optimisation don't need a CSP.
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
