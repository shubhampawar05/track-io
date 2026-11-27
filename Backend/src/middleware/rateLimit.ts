import type { NextFunction, Request, Response } from "express";
import { fail } from "../types/api";

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const DEFAULT_MAX = 20;

function keyFor(req: Request, prefix: string): string {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  return `${prefix}:${ip}`;
}

/** Simple fixed-window rate limiter (in-memory; fine for single instance / dev). */
export function rateLimit(prefix: string, maxPerWindow = DEFAULT_MAX) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFor(req, prefix);
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now - b.windowStart >= WINDOW_MS) {
      b = { count: 0, windowStart: now };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > maxPerWindow) {
      res.status(429).json(fail("Too many requests. Try again later."));
      return;
    }
    next();
  };
}
