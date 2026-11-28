import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { as, registerUser, startApp, stopApp, type TestUser } from "./helpers";

let app: Express;
let user: TestUser;

beforeAll(async () => {
  app = await startApp("security");
  user = await registerUser(app, "Sec", "sec@test.local");
});
afterAll(stopApp);

describe("CSRF origin check", () => {
  it("blocks state-changing requests from untrusted origins only", async () => {
    expect((await as(app, user).post("/api/projects").set("Origin", "https://evil.example").send({ name: "Evil" })).status).toBe(403);
    expect((await as(app, user).post("/api/projects").set("Origin", "http://localhost:3000").send({ name: "Good" })).status).toBe(200);
    expect((await as(app, user).get("/api/projects").set("Origin", "https://evil.example")).status).toBe(200);
    // The API's own origin (Swagger UI) is allowed.
    expect((await as(app, user).post("/api/projects").set("Origin", "http://127.0.0.1:4999").send({ name: "Docs" })).status).toBe(200);
  });
});

describe("headers", () => {
  it("sends baseline security headers", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", user.cookie);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("GitHub webhook endpoint", () => {
  it("handles hostile input without crashing", async () => {
    const send = (token: string, body: string, type = "application/json") =>
      request(app).post(`/api/integrations/github/webhook/${token}`).set("Content-Type", type).send(body);
    expect((await send("%25", "{}")).status).toBe(404);
    expect((await send("abc", "")).status).toBe(404);
    expect((await send("abc", "payload=x", "application/x-www-form-urlencoded")).status).toBe(415);
    // Still alive.
    expect((await request(app).get("/api/openapi.json")).status).toBe(200);
  });
});

describe("request log redaction", () => {
  it("never logs invite/reset tokens", async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    });
    await request(app).get("/api/auth/invite-preview?token=supersecret123");
    await new Promise((r) => setTimeout(r, 20));
    spy.mockRestore();
    const logged = lines.join("\n");
    expect(logged).not.toContain("supersecret123");
    expect(logged).toMatch(/token=(%5B|\[)redacted/);
  });
});
