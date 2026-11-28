import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, registerUser, startApp, stopApp } from "./helpers";

// Simulate a deployment with no trusted proxy: X-Forwarded-For must then be ignored.
process.env.TRUST_PROXY = "";

let app: Express;
beforeAll(async () => {
  app = await startApp("ratelimit");
});
afterAll(stopApp);

const login = (email: string, password: string, xff?: string) => {
  const r = request(app).post("/api/auth/login");
  if (xff) r.set("X-Forwarded-For", xff);
  return r.send({ email, password });
};

describe("per-account login limit", () => {
  it("counts only failures, resets on success, and ignores rotating X-Forwarded-For", async () => {
    await registerUser(app, "Lock", "lock@test.local");
    // Successful logins never lock the account.
    for (let i = 0; i < 11; i++) expect((await login("lock@test.local", "password123")).status).toBe(200);
    // 9 failures, then a success resets the counter.
    for (let i = 0; i < 9; i++) expect((await login("lock@test.local", "bad")).status).toBe(401);
    expect((await login("lock@test.local", "password123")).status).toBe(200);
    // 10 failures (rotating spoofed IPs) lock the account, even for the right password.
    for (let i = 0; i < 10; i++) expect((await login("lock@test.local", "bad", `1.2.3.${i}`)).status).toBe(401);
    const locked = await login("lock@test.local", "password123", "9.9.9.9");
    expect(locked.status).toBe(429);
    expect(Number(locked.headers["retry-after"])).toBeGreaterThan(0);
  });
});

describe("per-IP login limit", () => {
  it("cannot be bypassed by spoofing X-Forwarded-For", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 42; i++) statuses.push((await login(`user${i}@test.local`, "x")).status);
    expect(statuses.at(-1)).toBe(429);
    const spoofed = await login("someone@test.local", "x", "203.0.113.7");
    expect(spoofed.status).toBe(429);
  });
});

describe("AI endpoints", () => {
  it("limit each user to 30 transcribe calls per hour", async () => {
    const u = await registerUser(app, "Ai", "ai@test.local").catch(async () => {
      throw new Error("register blocked by IP limit; run this file in isolation");
    });
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      statuses.push((await as(app, u).post("/api/transcriptions/recordings/64b000000000000000000000/transcribe")).status);
    }
    expect(statuses.slice(0, 30).every((s) => s === 404)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});
