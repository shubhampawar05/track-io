import { describe, expect, it } from "vitest";
import { apiOriginFromEnv, buildContentSecurityPolicy } from "./csp";

const directive = (csp: string, name: string) =>
  csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? csp.split("; ").find((d) => d === name);

describe("buildContentSecurityPolicy", () => {
  const prod = buildContentSecurityPolicy({ nonce: "abc", apiOrigin: "https://api.example.com", isDev: false });
  const dev = buildContentSecurityPolicy({ nonce: "abc", apiOrigin: "http://localhost:4000", isDev: true });

  it("only runs nonce'd scripts, no unsafe-inline or eval in production", () => {
    const s = directive(prod, "script-src")!;
    expect(s).toContain("'nonce-abc'");
    expect(s).toContain("'strict-dynamic'");
    expect(s).not.toContain("unsafe-inline");
    expect(s).not.toContain("unsafe-eval");
  });

  it("allows the API origin for fetch, media and images", () => {
    for (const d of ["connect-src", "media-src", "img-src"]) {
      expect(directive(prod, d)).toContain("https://api.example.com");
    }
  });

  it("allows the Google Fonts stylesheet and font files used by globals.css", () => {
    expect(directive(prod, "style-src")).toContain("https://fonts.googleapis.com");
    expect(directive(prod, "font-src")).toContain("https://fonts.gstatic.com");
  });

  it("blocks framing, plugins and base-tag hijacking", () => {
    expect(directive(prod, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(prod, "object-src")).toBe("object-src 'none'");
    expect(directive(prod, "base-uri")).toBe("base-uri 'self'");
    expect(directive(prod, "upgrade-insecure-requests")).toBeDefined();
  });

  it("relaxes only what development needs", () => {
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws:");
    expect(directive(dev, "upgrade-insecure-requests")).toBeUndefined();
  });
});

describe("apiOriginFromEnv", () => {
  it("reduces a URL to its origin and falls back on bad input", () => {
    expect(apiOriginFromEnv("https://api.example.com/v1/")).toBe("https://api.example.com");
    expect(apiOriginFromEnv(undefined)).toBe("http://localhost:4000");
    expect(apiOriginFromEnv("not a url")).toBe("http://localhost:4000");
  });
});
