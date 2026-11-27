import jwt from "jsonwebtoken";
import { env } from "../config/env";

const COOKIE_NAME = "trackio_token";

export { COOKIE_NAME };

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { sub: string } | null {
  try {
    const p = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof p.sub === "string" && p.sub.length > 0) return { sub: p.sub };
    return null;
  } catch {
    return null;
  }
}
