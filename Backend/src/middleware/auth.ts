import type { NextFunction, Request, Response } from "express";
import { fail } from "../types/api";
import { COOKIE_NAME, verifyToken } from "../utils/jwt";

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const raw = req.cookies?.[COOKIE_NAME];
  const token = typeof raw === "string" ? raw : "";
  const payload = token ? verifyToken(token) : null;
  if (payload) req.userId = payload.sub;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json(fail("Unauthorized"));
    return;
  }
  next();
}
