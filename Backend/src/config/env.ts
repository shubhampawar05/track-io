import "dotenv/config";

const DEV_JWT_FALLBACK = "dev-only-jwt-secret-min-32-chars!!";
const MIN_JWT_SECRET_LENGTH = 32;

/** Publicly known values (source code / .env.example) that must never sign real sessions. */
const KNOWN_PLACEHOLDER_SECRETS = new Set([
  DEV_JWT_FALLBACK,
  "change-me-in-production-min-32-chars",
]);

/** Only an explicit local environment may fall back to an insecure secret. */
function isLocalDevEnvironment(): boolean {
  const nodeEnv = process.env.NODE_ENV?.trim();
  return nodeEnv === "development" || nodeEnv === "test";
}

function resolveJwtSecret(): string {
  const s = process.env.JWT_SECRET?.trim() ?? "";
  const isStrong = s.length >= MIN_JWT_SECRET_LENGTH && !KNOWN_PLACEHOLDER_SECRETS.has(s);
  if (isStrong) return s;
  if (!isLocalDevEnvironment()) {
    throw new Error(
      `JWT_SECRET must be a random value of at least ${MIN_JWT_SECRET_LENGTH} characters and not a placeholder ` +
        `(NODE_ENV=${process.env.NODE_ENV ?? "unset"}). Generate one with: openssl rand -base64 48`,
    );
  }
  // eslint-disable-next-line no-console
  console.warn(
    "[env] JWT_SECRET is missing, short or a placeholder — using an insecure dev secret. Never deploy like this.",
  );
  return s.length >= 16 ? s : DEV_JWT_FALLBACK;
}

function resolveGithubEncryptionKey(): string {
  const k = process.env.GITHUB_OAUTH_ENCRYPTION_KEY?.trim() ?? "";
  if (k.length >= 16) return k;
  if (process.env.NODE_ENV === "production" && process.env.GITHUB_CLIENT_ID?.trim()) {
    throw new Error(
      "GITHUB_OAUTH_ENCRYPTION_KEY must be set (min 16 chars) when GITHUB_CLIENT_ID is set in production",
    );
  }
  return "";
}

function resolveSmtpPort(): number {
  const n = Number(process.env.SMTP_PORT ?? 587);
  return Number.isFinite(n) ? n : 587;
}

function parseFrontendOrigins(): string[] {
  const raw = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
  const origins = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : ["http://localhost:3000"];
}

const frontendOrigins = parseFrontendOrigins();

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/trackio",
  JWT_SECRET: resolveJwtSecret(),
  /** Primary frontend URL (emails, OAuth redirects). First value when comma-separated. */
  FRONTEND_ORIGIN: frontendOrigins[0]!,
  /** Allowed browser origins for CORS (supports comma-separated FRONTEND_ORIGIN). */
  CORS_ORIGINS:
    frontendOrigins.length === 1 ? frontendOrigins[0]! : frontendOrigins,
  /** Display name in transactional emails (subjects, headers). */
  APP_NAME: process.env.APP_NAME?.trim() || "Trackio",
  /** Base URL clients use to load uploaded files (e.g. http://localhost:4000). */
  API_PUBLIC_URL: process.env.API_PUBLIC_URL?.trim() || "",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID?.trim() ?? "",
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET?.trim() ?? "",
  GITHUB_OAUTH_CALLBACK_URL: process.env.GITHUB_OAUTH_CALLBACK_URL?.trim() ?? "",
  GITHUB_OAUTH_ENCRYPTION_KEY: resolveGithubEncryptionKey(),
  /** SMTP (optional in dev; password reset / invites log to console when unset). */
  SMTP_HOST: process.env.SMTP_HOST?.trim() ?? "",
  SMTP_PORT: resolveSmtpPort(),
  SMTP_SECURE: String(process.env.SMTP_SECURE ?? "").toLowerCase() === "true",
  SMTP_USER: process.env.SMTP_USER?.trim() ?? "",
  SMTP_PASS: process.env.SMTP_PASS?.trim() ?? "",
  MAIL_FROM: process.env.MAIL_FROM?.trim() ?? "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY?.trim() ?? "",
  OPENAI_MODEL: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
  OPENAI_TRANSCRIBE_MODEL: process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe",
};
