import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { env } from "../config/env";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function keyBuf(): Buffer {
  const raw = env.GITHUB_OAUTH_ENCRYPTION_KEY;
  if (raw.length >= 16) return createHash("sha256").update(raw, "utf8").digest();
  return createHash("sha256").update(env.JWT_SECRET, "utf8").digest();
}

export function encryptGithubAccessToken(plain: string): {
  encryptedAccessToken: string;
  tokenIv: string;
  tokenAuthTag: string;
} {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, keyBuf(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedAccessToken: enc.toString("base64"),
    tokenIv: iv.toString("base64"),
    tokenAuthTag: authTag.toString("base64"),
  };
}

export function decryptGithubAccessToken(
  encryptedAccessToken: string,
  tokenIv: string,
  tokenAuthTag: string,
): string {
  const decipher = createDecipheriv(ALGO, keyBuf(), Buffer.from(tokenIv, "base64"));
  decipher.setAuthTag(Buffer.from(tokenAuthTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedAccessToken, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
