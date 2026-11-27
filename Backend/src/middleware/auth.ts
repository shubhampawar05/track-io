import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/User";
import { fail } from "../types/api";
import { COOKIE_NAME, verifyToken } from "../utils/jwt";

/**
 * Resolves req.userId from the session cookie. The token is only accepted while the user still
 * exists and its tokenVersion matches, so logout / password reset revoke issued sessions.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const raw = req.cookies?.[COOKIE_NAME];
  const token = typeof raw === "string" ? raw : "";
  const payload = token ? verifyToken(token) : null;
  if (payload && mongoose.Types.ObjectId.isValid(payload.sub)) {
    const user = await User.findById(payload.sub).select("tokenVersion").lean();
    if (user && (user.tokenVersion ?? 0) === payload.tv) req.userId = payload.sub;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json(fail("Unauthorized"));
    return;
  }
  next();
}
