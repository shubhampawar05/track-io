import jwt from "jsonwebtoken";
import { env } from "../config/env";

const COOKIE_NAME = "trackio_token";
const JWT_ALGORITHM = "HS256" as const;

export { COOKIE_NAME };

export function signToken(userId: string, tokenVersion: number): string {
  return jwt.sign({ sub: userId, tv: tokenVersion }, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: "7d",
  });
}

/** `tv` is the user's tokenVersion at sign time (tokens issued before it existed count as 0). */
export function verifyToken(token: string): { sub: string; tv: number } | null {
  try {
    const p = jwt.verify(token, env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as jwt.JwtPayload;
    if (typeof p.sub !== "string" || p.sub.length === 0) return null;
    return { sub: p.sub, tv: typeof p.tv === "number" ? p.tv : 0 };
  } catch {
    return null;
  }
}
