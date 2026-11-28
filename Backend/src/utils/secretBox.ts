import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { env, isLocalDevEnvironment } from "../config/env";
import { HttpError } from "../middleware/errorHandler";

/**
 * Authenticated encryption (AES-256-GCM) for secrets stored in MongoDB: GitHub OAuth access
 * tokens and GitHub webhook signing secrets.
 *
 * Format: `v2.<keyId>.<iv>.<authTag>.<ciphertext>` (base64url parts). The key id identifies
 * which configured key sealed the value, so keys can be rotated: set a new
 * GITHUB_OAUTH_ENCRYPTION_KEY, move the old one to GITHUB_OAUTH_ENCRYPTION_KEY_PREVIOUS, then
 * run `npm run migrate:secrets` to re-seal everything with the new key.
 */

const PREFIX = "v2";
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

type Key = { id: string; bytes: Buffer };

/** Domain-separated derivation, so the same passphrase never yields the same key elsewhere. */
function deriveKey(raw: string): Key {
  const bytes = createHash("sha256").update(`trackio:secret-box:v2:${raw}`, "utf8").digest();
  const id = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
  return { id, bytes };
}

let warnedDevFallback = false;

/** Key used to seal new values. */
function currentKey(): Key {
  if (env.GITHUB_OAUTH_ENCRYPTION_KEY) return deriveKey(env.GITHUB_OAUTH_ENCRYPTION_KEY);
  if (isLocalDevEnvironment()) {
    if (!warnedDevFallback) {
      warnedDevFallback = true;
      // eslint-disable-next-line no-console
      console.warn("[secretBox] GITHUB_OAUTH_ENCRYPTION_KEY not set — using a dev-only key derived from JWT_SECRET.");
    }
    return deriveKey(`dev-fallback:${env.JWT_SECRET}`);
  }
  throw new HttpError(503, "Server encryption key is not configured (GITHUB_OAUTH_ENCRYPTION_KEY)");
}

/** Every key that may have sealed an existing value (current first). */
function decryptionKeys(): Key[] {
  const keys: Key[] = [];
  try {
    keys.push(currentKey());
  } catch {
    // No current key: previous keys may still open old values.
  }
  for (const raw of env.GITHUB_OAUTH_ENCRYPTION_KEY_PREVIOUS) keys.push(deriveKey(raw));
  if (isLocalDevEnvironment()) keys.push(deriveKey(`dev-fallback:${env.JWT_SECRET}`));
  return keys;
}

const b64 = (b: Buffer) => b.toString("base64url");

export function isSealed(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith(`${PREFIX}.`) && value.split(".").length === 5;
}

/** Id of the key that sealed `value`, or null when it is not a sealed value. */
export function sealedKeyId(value: string): string | null {
  return isSealed(value) ? value.split(".")[1]! : null;
}

/** Whether `value` is sealed with the current key (nothing to migrate). */
export function isSealedWithCurrentKey(value: string): boolean {
  return sealedKeyId(value) === currentKey().id;
}

export function sealSecret(plain: string): string {
  const key = currentKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key.bytes, iv, { authTagLength: TAG_LENGTH });
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [PREFIX, key.id, b64(iv), b64(cipher.getAuthTag()), b64(ct)].join(".");
}

export class SecretUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretUnavailableError";
  }
}

export function openSecret(sealed: string): string {
  if (!isSealed(sealed)) throw new SecretUnavailableError("Value is not a sealed secret");
  const [, keyId, ivB64, tagB64, ctB64] = sealed.split(".") as [string, string, string, string, string];
  const key = decryptionKeys().find((k) => k.id === keyId);
  if (!key) {
    throw new SecretUnavailableError(
      `No configured key matches key id ${keyId}; add the old key to GITHUB_OAUTH_ENCRYPTION_KEY_PREVIOUS`,
    );
  }
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) throw new SecretUnavailableError("Malformed sealed secret");
  try {
    const decipher = createDecipheriv(ALGO, key.bytes, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new SecretUnavailableError("Sealed secret failed authentication (tampered or wrong key)");
  }
}

/**
 * Decrypts the pre-v2 GitHub token format (separate ciphertext / iv / tag fields, key =
 * sha256 of GITHUB_OAUTH_ENCRYPTION_KEY, or of JWT_SECRET when that was unset). Tries every
 * configured key because the original key may since have moved to the PREVIOUS list.
 */
export function openLegacyGithubToken(encryptedAccessToken: string, tokenIv: string, tokenAuthTag: string): string {
  const candidates = [env.GITHUB_OAUTH_ENCRYPTION_KEY, ...env.GITHUB_OAUTH_ENCRYPTION_KEY_PREVIOUS, env.JWT_SECRET].filter(
    (k) => k.length >= 16,
  );
  for (const raw of candidates) {
    try {
      const keyBytes = createHash("sha256").update(raw, "utf8").digest();
      const decipher = createDecipheriv(ALGO, keyBytes, Buffer.from(tokenIv, "base64"), { authTagLength: TAG_LENGTH });
      decipher.setAuthTag(Buffer.from(tokenAuthTag, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(encryptedAccessToken, "base64")), decipher.final()]).toString("utf8");
    } catch {
      // try the next candidate
    }
  }
  throw new SecretUnavailableError("Legacy GitHub token cannot be decrypted with any configured key");
}
