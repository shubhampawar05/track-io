import type { NextFunction, Request, Response } from "express";

/**
 * Baseline security headers for every API response (a dependency-free subset of helmet).
 * No global Content-Security-Policy: Swagger UI needs inline scripts, and file downloads set
 * their own sandboxed CSP.
 */
export function securityHeaders(isProduction: boolean) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    if (isProduction) {
      res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
    next();
  };
}
