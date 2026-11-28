import { afterEach, describe, expect, it, vi } from "vitest";

/** env.ts validates at import time, so each case re-imports it with fresh variables. */
async function loadEnv(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return (await import("../src/config/env")).env;
}

const saved = { ...process.env };

/** Values every non-development environment must provide. */
const PROD_REQUIRED = {
  MONGODB_URI: "mongodb://db.internal:27017/trackio",
  FRONTEND_ORIGIN: "https://app.example.com",
  API_PUBLIC_URL: "https://api.example.com",
};
afterEach(() => {
  process.env = { ...saved };
});

describe("JWT_SECRET policy", () => {
  it.each([
    ["staging + .env.example placeholder", { NODE_ENV: "staging", JWT_SECRET: "change-me-in-production-min-32-chars" }],
    ["NODE_ENV unset, no secret", { NODE_ENV: undefined, JWT_SECRET: "" }],
    ["production + source fallback", { NODE_ENV: "production", JWT_SECRET: "dev-only-jwt-secret-min-32-chars!!" }],
    ["production + short secret", { NODE_ENV: "production", JWT_SECRET: "short1234567890abc" }],
  ])("refuses to start: %s", async (_label, vars) => {
    await expect(loadEnv(vars)).rejects.toThrow(/JWT_SECRET/);
  });

  it("starts in production with a strong secret", async () => {
    const env = await loadEnv({ ...PROD_REQUIRED, NODE_ENV: "production", JWT_SECRET: "x".repeat(20) + "y".repeat(20) });
    expect(env.JWT_SECRET).toHaveLength(40);
  });

  it("allows an insecure fallback only in development/test", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const env = await loadEnv({ NODE_ENV: "development", JWT_SECRET: "" });
    expect(env.JWT_SECRET.length).toBeGreaterThan(0);
  });
});

describe("other env validation", () => {
  it("rejects an invalid PORT", async () => {
    await expect(loadEnv({ PORT: "abc" })).rejects.toThrow(/PORT/);
  });
  it("turns API docs off in production by default", async () => {
    const env = await loadEnv({ ...PROD_REQUIRED, NODE_ENV: "production", JWT_SECRET: "z".repeat(40), ENABLE_API_DOCS: undefined });
    expect(env.ENABLE_API_DOCS).toBe(false);
  });
  it("parses TRUST_PROXY", async () => {
    expect((await loadEnv({ TRUST_PROXY: "" })).TRUST_PROXY).toBe(false);
    expect((await loadEnv({ TRUST_PROXY: "1" })).TRUST_PROXY).toBe(1);
    expect((await loadEnv({ TRUST_PROXY: "loopback" })).TRUST_PROXY).toBe("loopback");
  });
  it.each(Object.keys(PROD_REQUIRED))("refuses to start in production without %s", async (name) => {
    await expect(
      loadEnv({ ...PROD_REQUIRED, [name]: undefined, NODE_ENV: "production", JWT_SECRET: "z".repeat(40) }),
    ).rejects.toThrow(new RegExp(`${name} must be set`));
  });
  it("keeps localhost defaults in development", async () => {
    const env = await loadEnv({ NODE_ENV: "development", MONGODB_URI: undefined, FRONTEND_ORIGIN: undefined });
    expect(env.MONGODB_URI).toMatch(/127\.0\.0\.1/);
    expect(env.FRONTEND_ORIGIN).toBe("http://localhost:3000");
  });
});
