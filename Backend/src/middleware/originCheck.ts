import type { NextFunction, Request, Response } from "express";
import { fail } from "../types/api";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for cookie-authenticated, state-changing requests. In production the session
 * cookie is SameSite=None, so a third-party site could otherwise submit "simple" cross-site
 * requests (CORS does not block those). Browsers always send Origin on cross-site POST/PATCH/
 * DELETE; requests without an Origin (server-to-server, curl) carry no ambient browser cookie
 * and are allowed.
 */
export function requireTrustedOrigin(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins.map((o) => o.replace(/\/$/, "")));
  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = req.headers.origin;
    if (!origin || allowed.has(origin.replace(/\/$/, ""))) {
      next();
      return;
    }
    res.status(403).json(fail("Request origin not allowed"));
  };
}
