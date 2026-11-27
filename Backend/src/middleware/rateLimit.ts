import type { NextFunction, Request, Response } from "express";
import { fail } from "../types/api";

type Bucket = { count: number; windowStart: number; windowMs: number };

const buckets = new Map<string, Bucket>();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 20;
/** Sweep expired buckets at most this often so spoofed/rotating keys cannot grow memory forever. */
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();

function sweepExpired(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (now - b.windowStart >= b.windowMs) buckets.delete(key);
  }
}

/**
 * Client IP as resolved by Express. `req.ip` only honours X-Forwarded-For when
 * `trust proxy` is configured (TRUST_PROXY env), so clients cannot spoof it.
 */
function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export type RateLimitOptions = {
  windowMs?: number;
  /** Custom key (e.g. account email). Return null to skip this limiter for the request. */
  keyBy?: (req: Request) => string | null;
  /**
   * Count only failed requests (status >= 400, except 429) and reset the bucket after a
   * success. Used for per-account login throttling so real sign-ins never lock a user out.
   */
  failuresOnly?: boolean;
};

/** Simple fixed-window rate limiter (in-memory; per process — use a shared store when scaling out). */
export function rateLimit(prefix: string, maxPerWindow = DEFAULT_MAX, options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    sweepExpired(now);
    const id = options.keyBy ? options.keyBy(req) : clientIp(req);
    if (id === null) {
      next();
      return;
    }
    const key = `${prefix}:${id}`;
    let b = buckets.get(key);
    if (!b || now - b.windowStart >= b.windowMs) {
      b = { count: 0, windowStart: now, windowMs };
      buckets.set(key, b);
    }
    const bucket = b;
    if (options.failuresOnly) {
      if (bucket.count >= maxPerWindow) {
        reject(res, bucket, now);
        return;
      }
      res.on("finish", () => {
        if (res.statusCode < 400) buckets.delete(key);
        else if (res.statusCode !== 429) bucket.count += 1;
      });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > maxPerWindow) {
      reject(res, bucket, now);
      return;
    }
    next();
  };
}

function reject(res: Response, b: Bucket, now: number) {
  const retryAfterSec = Math.ceil((b.windowStart + b.windowMs - now) / 1000);
  res.setHeader("Retry-After", String(Math.max(retryAfterSec, 1)));
  res.status(429).json(fail("Too many requests. Try again later."));
}

/** Keys a limiter on the normalized `email` field of a JSON body (per-account throttling). */
export function byBodyEmail(req: Request): string | null {
  const raw = (req.body as { email?: unknown } | undefined)?.email;
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email ? email : null;
}
