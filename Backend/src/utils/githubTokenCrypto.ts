import { isSealed, openLegacyGithubToken, openSecret, sealSecret } from "./secretBox";

/** Fields of a GithubIntegration document that hold the access token (v2 or legacy format). */
export type StoredGithubToken = {
  sealedAccessToken?: string | null;
  encryptedAccessToken?: string | null;
  tokenIv?: string | null;
  tokenAuthTag?: string | null;
};

/** Encrypts a GitHub access token for storage (v2 sealed format). */
export function encryptGithubAccessToken(plain: string): { sealedAccessToken: string } {
  return { sealedAccessToken: sealSecret(plain) };
}

/** Decrypts a stored token in either the v2 or the legacy format. Throws SecretUnavailableError. */
export function decryptGithubAccessToken(doc: StoredGithubToken): string {
  if (isSealed(doc.sealedAccessToken)) return openSecret(doc.sealedAccessToken);
  if (doc.encryptedAccessToken && doc.tokenIv && doc.tokenAuthTag) {
    return openLegacyGithubToken(doc.encryptedAccessToken, doc.tokenIv, doc.tokenAuthTag);
  }
  throw new Error("GitHub integration has no stored token");
}

/** Mongo update that stores a token in the v2 format and drops the legacy fields. */
export function githubTokenUpdate(plain: string) {
  return {
    $set: encryptGithubAccessToken(plain),
    $unset: { encryptedAccessToken: 1, tokenIv: 1, tokenAuthTag: 1 },
  };
}
