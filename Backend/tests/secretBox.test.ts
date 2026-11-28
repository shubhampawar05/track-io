import { createCipheriv, createHash, randomBytes } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

/** secretBox reads keys from env at import time: re-import with fresh variables. */
async function load(vars: Record<string, string | undefined> = {}) {
  vi.resetModules();
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import("../src/utils/secretBox");
}

const KEY_A = "a".repeat(40);
const KEY_B = "b".repeat(40);

describe("sealSecret / openSecret", () => {
  it("round-trips and never stores plaintext", async () => {
    const box = await load({ GITHUB_OAUTH_ENCRYPTION_KEY: KEY_A });
    const sealed = box.sealSecret("ghp_supersecret");
    expect(sealed.startsWith("v2.")).toBe(true);
    expect(sealed).not.toContain("supersecret");
    expect(box.openSecret(sealed)).toBe("ghp_supersecret");
    expect(box.sealSecret("x")).not.toBe(box.sealSecret("x")); // random IV
  });

  it("detects tampering", async () => {
    const box = await load({ GITHUB_OAUTH_ENCRYPTION_KEY: KEY_A });
    const parts = box.sealSecret("value").split(".");
    const ct = Buffer.from(parts[4]!, "base64url");
    ct[0] = ct[0]! ^ 0xff;
    parts[4] = ct.toString("base64url");
    expect(() => box.openSecret(parts.join("."))).toThrow(box.SecretUnavailableError);
  });

  it("supports key rotation through GITHUB_OAUTH_ENCRYPTION_KEY_PREVIOUS", async () => {
    const sealedWithA = (await load({ GITHUB_OAUTH_ENCRYPTION_KEY: KEY_A })).sealSecret("rotate-me");

    const withoutOld = await load({ GITHUB_OAUTH_ENCRYPTION_KEY: KEY_B, GITHUB_OAUTH_ENCRYPTION_KEY_PREVIOUS: "" });
    expect(() => withoutOld.openSecret(sealedWithA)).toThrow(/PREVIOUS/);

    const rotated = await load({ GITHUB_OAUTH_ENCRYPTION_KEY: KEY_B, GITHUB_OAUTH_ENCRYPTION_KEY_PREVIOUS: KEY_A });
    expect(rotated.openSecret(sealedWithA)).toBe("rotate-me");
    expect(rotated.isSealedWithCurrentKey(sealedWithA)).toBe(false);
    expect(rotated.isSealedWithCurrentKey(rotated.sealSecret("new"))).toBe(true);
  });

  it("requires a key outside development/test", async () => {
    const box = await load({ NODE_ENV: "production", JWT_SECRET: "p".repeat(40), GITHUB_OAUTH_ENCRYPTION_KEY: "" });
    expect(() => box.sealSecret("x")).toThrow(/encryption key/i);
  });

  it("rejects short current keys at startup", async () => {
    await expect(load({ GITHUB_OAUTH_ENCRYPTION_KEY: "short-key-123456" })).rejects.toThrow(/at least 32/);
  });
});

describe("legacy GitHub token format", () => {
  function legacyEncrypt(plain: string, rawKey: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(rawKey, "utf8").digest(), iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return { encryptedAccessToken: enc.toString("base64"), tokenIv: iv.toString("base64"), tokenAuthTag: cipher.getAuthTag().toString("base64") };
  }

  it("decrypts tokens made with the old JWT_SECRET-derived key", async () => {
    await load({ GITHUB_OAUTH_ENCRYPTION_KEY: KEY_A });
    const { decryptGithubAccessToken } = await import("../src/utils/githubTokenCrypto");
    expect(decryptGithubAccessToken(legacyEncrypt("ghp_old", process.env.JWT_SECRET!))).toBe("ghp_old");
  });

  it("decrypts tokens made with a shorter old key moved to PREVIOUS", async () => {
    const oldKey = "sixteen-chars-ok";
    await load({ GITHUB_OAUTH_ENCRYPTION_KEY: KEY_A, GITHUB_OAUTH_ENCRYPTION_KEY_PREVIOUS: oldKey });
    const { decryptGithubAccessToken } = await import("../src/utils/githubTokenCrypto");
    expect(decryptGithubAccessToken(legacyEncrypt("ghp_prev", oldKey))).toBe("ghp_prev");
  });
});
