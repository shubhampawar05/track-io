import { createHmac, timingSafeEqual } from "crypto";

/** Verify `X-Hub-Signature-256` from GitHub (payload must be raw bytes). */
export function verifyGithubWebhookSignature(raw: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!secret || !signatureHeader || !raw.length) return false;
  const expectedHex = createHmac("sha256", secret).update(raw).digest("hex");
  const expected = `sha256=${expectedHex}`;
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signatureHeader, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
