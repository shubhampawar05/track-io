import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";
import { inject } from "vitest";

let ipCounter = 0;
/** A fresh fake client IP, so rate limits keyed by IP don't leak between helper calls. */
export function nextIp(): string {
  ipCounter += 1;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

/** Connects mongoose to a database unique to the calling test file and builds the app. */
export async function startApp(dbName: string): Promise<Express> {
  const uri = `${inject("mongoBaseUri")}${dbName}`;
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  const { createApp } = await import("../src/app");
  // Build indexes up front so unique constraints are in force for race tests.
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  return createApp();
}

export async function stopApp(): Promise<void> {
  await mongoose.connection.dropDatabase().catch(() => undefined);
  await mongoose.disconnect();
}

export type TestUser = { id: string; cookie: string; org: string; email: string };

export function cookieFrom(res: request.Response): string {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  const c = raw?.find((v) => v.startsWith("trackio_token="));
  if (!c) throw new Error(`no session cookie (status ${res.status}): ${JSON.stringify(res.body)}`);
  return c.split(";")[0]!;
}

export async function registerUser(app: Express, name: string, email: string, password = "password123"): Promise<TestUser> {
  const res = await request(app)
    .post("/api/auth/register")
    .set("X-Forwarded-For", nextIp())
    .send({ name, email, password });
  if (res.status !== 200) throw new Error(`register failed ${res.status}: ${JSON.stringify(res.body)}`);
  return {
    id: res.body.data.id,
    cookie: cookieFrom(res),
    org: res.body.data.currentOrganizationId,
    email,
  };
}

/** Authenticated, org-scoped request builder. */
export function as(app: Express, user: TestUser) {
  const wrap = (r: request.Test) => r.set("Cookie", user.cookie).set("X-Organization-Id", user.org).set("X-Forwarded-For", nextIp());
  return {
    get: (path: string) => wrap(request(app).get(path)),
    post: (path: string) => wrap(request(app).post(path)),
    patch: (path: string) => wrap(request(app).patch(path)),
    delete: (path: string) => wrap(request(app).delete(path)),
  };
}

export async function createProject(app: Express, user: TestUser, name: string): Promise<string> {
  const res = await as(app, user).post("/api/projects").send({ name });
  if (res.status !== 200) throw new Error(`create project failed ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.data.slug as string;
}

export async function createIssue(app: Express, user: TestUser, slug: string, body: Record<string, unknown> = {}): Promise<string> {
  const res = await as(app, user).post(`/api/projects/${encodeURIComponent(slug)}/issues`).send({ title: "Issue", ...body });
  if (res.status !== 200) throw new Error(`create issue failed ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.data.id as string;
}

/** Smallest valid PNG signature + padding (passes the upload signature check). */
export const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

export async function uploadPng(app: Express, user: TestUser, filename = "x.png"): Promise<string> {
  const res = await as(app, user).post("/api/uploads").attach("file", PNG_BYTES, { filename, contentType: "image/png" });
  if (res.status !== 200) throw new Error(`upload failed ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.data.url as string;
}
