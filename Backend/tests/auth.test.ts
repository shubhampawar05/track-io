import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, cookieFrom, nextIp, registerUser, startApp, stopApp } from "./helpers";

let app: Express;
beforeAll(async () => {
  app = await startApp("auth");
});
afterAll(stopApp);

const login = (email: string, password: string) =>
  request(app).post("/api/auth/login").set("X-Forwarded-For", nextIp()).send({ email, password });

describe("register / login", () => {
  it("registers, sets an httpOnly session cookie and returns the user's workspace", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("X-Forwarded-For", nextIp())
      .send({ name: "Ada", email: "ada@test.local", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.data.organizations).toHaveLength(1);
    const setCookie = (res.headers["set-cookie"] as unknown as string[]).join(";");
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it("returns 409 (not 500) for concurrent registrations of one email", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post("/api/auth/register")
          .set("X-Forwarded-For", nextIp())
          .send({ name: "Dup", email: "dup@test.local", password: "password123" }),
      ),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409, 409]);
  });

  it.each([
    [{ name: "x", email: "notanemail", password: "password123" }, "invalid email"],
    [{ name: "x", email: "short@test.local", password: "1234567" }, "short password"],
    [{ name: "n".repeat(101), email: "long@test.local", password: "password123" }, "long name"],
  ])("rejects %j (%s) with 400", async (body) => {
    const res = await request(app).post("/api/auth/register").set("X-Forwarded-For", nextIp()).send(body);
    expect(res.status).toBe(400);
  });

  it("logs in case-insensitively and rejects wrong passwords and operator objects", async () => {
    await registerUser(app, "Bob", "bob@test.local");
    expect((await login("BOB@test.local", "password123")).status).toBe(200);
    expect((await login("bob@test.local", "wrong-password")).status).toBe(401);
    const injected = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", nextIp())
      .send({ email: { $ne: null }, password: { $ne: null } });
    expect(injected.status).toBe(401);
  });
});

describe("sessions", () => {
  it("rejects alg=none tokens", async () => {
    const user = await registerUser(app, "Eve", "eve@test.local");
    const sub = JSON.parse(Buffer.from(user.cookie.split("=")[1]!.split(".")[1]!, "base64url").toString()).sub;
    const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub, exp: 9_999_999_999 })).toString("base64url");
    const res = await request(app).get("/api/auth/me").set("Cookie", `trackio_token=${header}.${payload}.`);
    expect(res.status).toBe(401);
  });

  it("logout revokes every session of the user", async () => {
    const user = await registerUser(app, "Multi", "multi@test.local");
    const second = cookieFrom(await login("multi@test.local", "password123"));
    expect((await request(app).get("/api/auth/me").set("Cookie", second)).status).toBe(200);

    expect((await as(app, user).post("/api/auth/logout")).status).toBe(200);

    expect((await request(app).get("/api/auth/me").set("Cookie", user.cookie)).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Cookie", second)).status).toBe(401);
    expect((await login("multi@test.local", "password123")).status).toBe(200);
  });

  it("logout works with an invalid cookie and clears it", async () => {
    const res = await request(app).post("/api/auth/logout").set("Cookie", "trackio_token=garbage");
    expect(res.status).toBe(200);
    expect((res.headers["set-cookie"] as unknown as string[]).join(";")).toMatch(/trackio_token=;/);
  });

  it("password reset revokes existing sessions", async () => {
    const { User } = await import("../src/models/User");
    const { hashToken } = await import("../src/utils/tokenCrypto");
    const user = await registerUser(app, "Reset", "reset@test.local");
    await User.updateOne(
      { email: "reset@test.local" },
      { passwordResetTokenHash: hashToken("raw-reset-token"), passwordResetExpiresAt: new Date(Date.now() + 60_000) },
    );
    const res = await request(app)
      .post("/api/auth/reset-password")
      .set("X-Forwarded-For", nextIp())
      .send({ token: "raw-reset-token", password: "brand-new-password" });
    expect(res.status).toBe(200);
    expect((await request(app).get("/api/auth/me").set("Cookie", user.cookie)).status).toBe(401);
    expect((await login("reset@test.local", "brand-new-password")).status).toBe(200);
    // Single use.
    const again = await request(app)
      .post("/api/auth/reset-password")
      .set("X-Forwarded-For", nextIp())
      .send({ token: "raw-reset-token", password: "another-password" });
    expect(again.status).toBe(400);
  });

  it("forgot-password answers identically for known and unknown emails", async () => {
    await registerUser(app, "Known", "known@test.local");
    const known = await request(app).post("/api/auth/forgot-password").set("X-Forwarded-For", nextIp()).send({ email: "known@test.local" });
    const unknown = await request(app).post("/api/auth/forgot-password").set("X-Forwarded-For", nextIp()).send({ email: "nobody@test.local" });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });
});
